package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"light-oss/backend/internal/config"
	"light-oss/backend/internal/handler"
	"light-oss/backend/internal/middleware"
	"light-oss/backend/internal/model"
	"light-oss/backend/internal/repository"
	"light-oss/backend/internal/service"
	"light-oss/backend/internal/signing"
	"light-oss/backend/internal/storage"
)

type apiEnvelope[T any] struct {
	Data  T             `json:"data"`
	Error *apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type bucketResponse struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}

type bucketListResponse struct {
	Items []bucketResponse `json:"items"`
}

type objectResponse struct {
	ObjectKey        string `json:"object_key"`
	OriginalFilename string `json:"original_filename"`
	Visibility       string `json:"visibility"`
	Size             int64  `json:"size"`
}

type objectListResponse struct {
	Items      []objectResponse `json:"items"`
	NextCursor string           `json:"next_cursor"`
}

type folderNodeResponse struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	ParentPath string `json:"parent_path"`
}

type folderListResponse struct {
	Items []folderNodeResponse `json:"items"`
}

type explorerEntryResponse struct {
	Type      string  `json:"type"`
	Path      string  `json:"path"`
	Name      string  `json:"name"`
	IsEmpty   *bool   `json:"is_empty"`
	ObjectKey *string `json:"object_key"`
}

type explorerListResponse struct {
	Items      []explorerEntryResponse `json:"items"`
	NextCursor string                  `json:"next_cursor"`
}

type signResponse struct {
	URL string `json:"url"`
}

func TestProtectedRoutesRequireAuth(t *testing.T) {
	router := newTestRouter(t, 1024)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/buckets", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestUploadAndDownloadPublicObject(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "public-bucket")

	req := httptest.NewRequest(http.MethodPut, "/api/v1/buckets/public-bucket/objects/docs/readme.txt", strings.NewReader("hello world"))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("X-Object-Visibility", "public")
	req.Header.Set("X-Original-Filename", "readme.txt")
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}

	var uploadBody apiEnvelope[objectResponse]
	decodeJSON(t, rec.Body.Bytes(), &uploadBody)
	if uploadBody.Data.OriginalFilename != "readme.txt" {
		t.Fatalf("unexpected original filename %q", uploadBody.Data.OriginalFilename)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/public-bucket/objects/docs/readme.txt", nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getRec.Code)
	}
	if body := getRec.Body.String(); body != "hello world" {
		t.Fatalf("unexpected body %q", body)
	}
	if got := getRec.Header().Get("ETag"); got == "" {
		t.Fatalf("expected etag header")
	}

	headReq := httptest.NewRequest(http.MethodHead, "/api/v1/buckets/public-bucket/objects/docs/readme.txt", nil)
	headRec := httptest.NewRecorder()
	router.ServeHTTP(headRec, headReq)
	if headRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", headRec.Code)
	}
}

func TestPrivateObjectRequiresAuthOrSignature(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "private-bucket")
	uploadObject(t, router, "/api/v1/buckets/private-bucket/objects/secrets/report.txt", "very secret", "private")

	anonymousReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/private-bucket/objects/secrets/report.txt", nil)
	anonymousRec := httptest.NewRecorder()
	router.ServeHTTP(anonymousRec, anonymousReq)
	if anonymousRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", anonymousRec.Code)
	}

	authReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/private-bucket/objects/secrets/report.txt", nil)
	authReq.Header.Set("Authorization", "Bearer dev-token")
	authRec := httptest.NewRecorder()
	router.ServeHTTP(authRec, authReq)
	if authRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", authRec.Code)
	}

	signReq := httptest.NewRequest(http.MethodPost, "/api/v1/sign/download", bytes.NewBufferString(`{"bucket":"private-bucket","object_key":"secrets/report.txt","expires_in_seconds":300}`))
	signReq.Header.Set("Authorization", "Bearer dev-token")
	signReq.Header.Set("Content-Type", "application/json")
	signRec := httptest.NewRecorder()
	router.ServeHTTP(signRec, signReq)
	if signRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", signRec.Code, signRec.Body.String())
	}

	var signBody apiEnvelope[signResponse]
	decodeJSON(t, signRec.Body.Bytes(), &signBody)
	parsed, err := url.Parse(signBody.Data.URL)
	if err != nil {
		t.Fatalf("parse signed url: %v", err)
	}

	signedReq := httptest.NewRequest(http.MethodGet, parsed.RequestURI(), nil)
	signedRec := httptest.NewRecorder()
	router.ServeHTTP(signedRec, signedReq)
	if signedRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", signedRec.Code, signedRec.Body.String())
	}

	query := parsed.Query()
	query.Set("signature", "broken")
	parsed.RawQuery = query.Encode()
	tamperedReq := httptest.NewRequest(http.MethodGet, parsed.RequestURI(), nil)
	tamperedRec := httptest.NewRecorder()
	router.ServeHTTP(tamperedRec, tamperedReq)
	if tamperedRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", tamperedRec.Code)
	}
}

func TestListObjectsPaginationAndPrefix(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "list-bucket")
	uploadObject(t, router, "/api/v1/buckets/list-bucket/objects/docs/a.txt", "A", "public")
	time.Sleep(2 * time.Millisecond)
	uploadObject(t, router, "/api/v1/buckets/list-bucket/objects/docs/b.txt", "B", "public")
	time.Sleep(2 * time.Millisecond)
	uploadObject(t, router, "/api/v1/buckets/list-bucket/objects/images/c.txt", "C", "public")

	firstReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/list-bucket/objects?prefix=docs/&limit=1", nil)
	firstReq.Header.Set("Authorization", "Bearer dev-token")
	firstRec := httptest.NewRecorder()
	router.ServeHTTP(firstRec, firstReq)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", firstRec.Code)
	}

	var firstBody apiEnvelope[objectListResponse]
	decodeJSON(t, firstRec.Body.Bytes(), &firstBody)
	if len(firstBody.Data.Items) != 1 || firstBody.Data.Items[0].ObjectKey != "docs/b.txt" {
		t.Fatalf("unexpected first page: %+v", firstBody.Data.Items)
	}
	if firstBody.Data.NextCursor == "" {
		t.Fatalf("expected next_cursor")
	}

	secondReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/list-bucket/objects?prefix=docs/&limit=1&cursor="+url.QueryEscape(firstBody.Data.NextCursor), nil)
	secondReq.Header.Set("Authorization", "Bearer dev-token")
	secondRec := httptest.NewRecorder()
	router.ServeHTTP(secondRec, secondReq)
	if secondRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", secondRec.Code)
	}

	var secondBody apiEnvelope[objectListResponse]
	decodeJSON(t, secondRec.Body.Bytes(), &secondBody)
	if len(secondBody.Data.Items) != 1 || secondBody.Data.Items[0].ObjectKey != "docs/a.txt" {
		t.Fatalf("unexpected second page: %+v", secondBody.Data.Items)
	}
}

func TestUploadDecodesEncodedOriginalFilenameHeader(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "encoded-bucket")

	req := httptest.NewRequest(http.MethodPut, "/api/v1/buckets/encoded-bucket/objects/docs/report.txt", strings.NewReader("hello"))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("X-Object-Visibility", "public")
	req.Header.Set("X-Original-Filename", url.PathEscape("中文报告.txt"))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}

	var uploadBody apiEnvelope[objectResponse]
	decodeJSON(t, rec.Body.Bytes(), &uploadBody)
	if uploadBody.Data.OriginalFilename != "中文报告.txt" {
		t.Fatalf("unexpected original filename %q", uploadBody.Data.OriginalFilename)
	}
}

func TestListFoldersAndExplorerEntries(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "tree-bucket")
	uploadObject(t, router, "/api/v1/buckets/tree-bucket/objects/docs/alpha.txt", "A", "public")
	uploadObject(t, router, "/api/v1/buckets/tree-bucket/objects/docs/zeta.txt", "Z", "public")
	uploadObject(t, router, "/api/v1/buckets/tree-bucket/objects/docs/images/c.txt", "C", "public")
	createFolder(t, router, "tree-bucket", "docs/", "empty")

	foldersReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/tree-bucket/folders", nil)
	foldersReq.Header.Set("Authorization", "Bearer dev-token")
	foldersRec := httptest.NewRecorder()
	router.ServeHTTP(foldersRec, foldersReq)
	if foldersRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", foldersRec.Code, foldersRec.Body.String())
	}

	var foldersBody apiEnvelope[folderListResponse]
	decodeJSON(t, foldersRec.Body.Bytes(), &foldersBody)
	if len(foldersBody.Data.Items) != 3 {
		t.Fatalf("unexpected folder count: %+v", foldersBody.Data.Items)
	}
	if foldersBody.Data.Items[0].Path != "docs/" || foldersBody.Data.Items[1].Path != "docs/empty/" || foldersBody.Data.Items[2].Path != "docs/images/" {
		t.Fatalf("unexpected folders: %+v", foldersBody.Data.Items)
	}

	firstEntriesReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/tree-bucket/entries?prefix=docs/&limit=2", nil)
	firstEntriesReq.Header.Set("Authorization", "Bearer dev-token")
	firstEntriesRec := httptest.NewRecorder()
	router.ServeHTTP(firstEntriesRec, firstEntriesReq)
	if firstEntriesRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", firstEntriesRec.Code, firstEntriesRec.Body.String())
	}

	var firstEntriesBody apiEnvelope[explorerListResponse]
	decodeJSON(t, firstEntriesRec.Body.Bytes(), &firstEntriesBody)
	if len(firstEntriesBody.Data.Items) != 2 {
		t.Fatalf("unexpected first entries page: %+v", firstEntriesBody.Data.Items)
	}
	if firstEntriesBody.Data.Items[0].Type != "directory" || firstEntriesBody.Data.Items[0].Name != "empty" {
		t.Fatalf("unexpected first directory entry: %+v", firstEntriesBody.Data.Items[0])
	}
	if firstEntriesBody.Data.Items[0].IsEmpty == nil || !*firstEntriesBody.Data.Items[0].IsEmpty {
		t.Fatalf("expected empty directory flag on %+v", firstEntriesBody.Data.Items[0])
	}
	if firstEntriesBody.Data.Items[1].Type != "directory" || firstEntriesBody.Data.Items[1].Name != "images" {
		t.Fatalf("unexpected second directory entry: %+v", firstEntriesBody.Data.Items[1])
	}
	if firstEntriesBody.Data.NextCursor == "" {
		t.Fatalf("expected next cursor for first entries page")
	}

	secondEntriesReq := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/buckets/tree-bucket/entries?prefix=docs/&limit=2&cursor="+url.QueryEscape(firstEntriesBody.Data.NextCursor),
		nil,
	)
	secondEntriesReq.Header.Set("Authorization", "Bearer dev-token")
	secondEntriesRec := httptest.NewRecorder()
	router.ServeHTTP(secondEntriesRec, secondEntriesReq)
	if secondEntriesRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", secondEntriesRec.Code, secondEntriesRec.Body.String())
	}

	var secondEntriesBody apiEnvelope[explorerListResponse]
	decodeJSON(t, secondEntriesRec.Body.Bytes(), &secondEntriesBody)
	if len(secondEntriesBody.Data.Items) != 2 {
		t.Fatalf("unexpected second entries page: %+v", secondEntriesBody.Data.Items)
	}
	if secondEntriesBody.Data.Items[0].Type != "file" || secondEntriesBody.Data.Items[0].Name != "alpha.txt" {
		t.Fatalf("unexpected file entry: %+v", secondEntriesBody.Data.Items[0])
	}
	if secondEntriesBody.Data.Items[1].Type != "file" || secondEntriesBody.Data.Items[1].Name != "zeta.txt" {
		t.Fatalf("unexpected file entry: %+v", secondEntriesBody.Data.Items[1])
	}

	searchReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/tree-bucket/entries?prefix=docs/&search=alp", nil)
	searchReq.Header.Set("Authorization", "Bearer dev-token")
	searchRec := httptest.NewRecorder()
	router.ServeHTTP(searchRec, searchReq)
	if searchRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", searchRec.Code, searchRec.Body.String())
	}

	var searchBody apiEnvelope[explorerListResponse]
	decodeJSON(t, searchRec.Body.Bytes(), &searchBody)
	if len(searchBody.Data.Items) != 1 || searchBody.Data.Items[0].Name != "alpha.txt" {
		t.Fatalf("unexpected search results: %+v", searchBody.Data.Items)
	}
}

func TestCreateAndDeleteFolder(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "folder-bucket")
	createFolder(t, router, "folder-bucket", "", "empty")

	duplicateReq := httptest.NewRequest(http.MethodPost, "/api/v1/buckets/folder-bucket/folders", bytes.NewBufferString(`{"prefix":"","name":"empty"}`))
	duplicateReq.Header.Set("Authorization", "Bearer dev-token")
	duplicateReq.Header.Set("Content-Type", "application/json")
	duplicateRec := httptest.NewRecorder()
	router.ServeHTTP(duplicateRec, duplicateReq)
	if duplicateRec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d, body=%s", duplicateRec.Code, duplicateRec.Body.String())
	}

	deleteEmptyReq := httptest.NewRequest(http.MethodDelete, "/api/v1/buckets/folder-bucket/folders?path="+url.QueryEscape("empty/"), nil)
	deleteEmptyReq.Header.Set("Authorization", "Bearer dev-token")
	deleteEmptyRec := httptest.NewRecorder()
	router.ServeHTTP(deleteEmptyRec, deleteEmptyReq)
	if deleteEmptyRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d, body=%s", deleteEmptyRec.Code, deleteEmptyRec.Body.String())
	}

	uploadObject(t, router, "/api/v1/buckets/folder-bucket/objects/docs/readme.txt", "hello", "public")
	uploadObject(t, router, "/api/v1/buckets/folder-bucket/objects/docs/nested/guide.txt", "nested", "private")

	deleteNonEmptyReq := httptest.NewRequest(http.MethodDelete, "/api/v1/buckets/folder-bucket/folders?path="+url.QueryEscape("docs/"), nil)
	deleteNonEmptyReq.Header.Set("Authorization", "Bearer dev-token")
	deleteNonEmptyRec := httptest.NewRecorder()
	router.ServeHTTP(deleteNonEmptyRec, deleteNonEmptyReq)
	if deleteNonEmptyRec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d, body=%s", deleteNonEmptyRec.Code, deleteNonEmptyRec.Body.String())
	}

	deleteRecursiveReq := httptest.NewRequest(
		http.MethodDelete,
		"/api/v1/buckets/folder-bucket/folders?path="+url.QueryEscape("docs/")+"&recursive=true",
		nil,
	)
	deleteRecursiveReq.Header.Set("Authorization", "Bearer dev-token")
	deleteRecursiveRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRecursiveRec, deleteRecursiveReq)
	if deleteRecursiveRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d, body=%s", deleteRecursiveRec.Code, deleteRecursiveRec.Body.String())
	}

	listEntriesReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/folder-bucket/entries", nil)
	listEntriesReq.Header.Set("Authorization", "Bearer dev-token")
	listEntriesRec := httptest.NewRecorder()
	router.ServeHTTP(listEntriesRec, listEntriesReq)
	if listEntriesRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", listEntriesRec.Code, listEntriesRec.Body.String())
	}

	var listEntriesBody apiEnvelope[explorerListResponse]
	decodeJSON(t, listEntriesRec.Body.Bytes(), &listEntriesBody)
	if len(listEntriesBody.Data.Items) != 0 {
		t.Fatalf("expected empty root after recursive delete, got %+v", listEntriesBody.Data.Items)
	}

	deleteMissingReq := httptest.NewRequest(
		http.MethodDelete,
		"/api/v1/buckets/folder-bucket/folders?path="+url.QueryEscape("missing/")+"&recursive=true",
		nil,
	)
	deleteMissingReq.Header.Set("Authorization", "Bearer dev-token")
	deleteMissingRec := httptest.NewRecorder()
	router.ServeHTTP(deleteMissingRec, deleteMissingReq)
	if deleteMissingRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d, body=%s", deleteMissingRec.Code, deleteMissingRec.Body.String())
	}
}

func TestRecursiveDeleteEscapesLikeWildcards(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "wildcard-bucket")
	uploadObject(t, router, "/api/v1/buckets/wildcard-bucket/objects/a_/keep.txt", "keep", "public")
	uploadObject(t, router, "/api/v1/buckets/wildcard-bucket/objects/ab/stay.txt", "stay", "public")
	uploadObject(t, router, "/api/v1/buckets/wildcard-bucket/objects/ghosts/readme.txt", "ghost", "public")

	deleteUnderscoreReq := httptest.NewRequest(
		http.MethodDelete,
		"/api/v1/buckets/wildcard-bucket/folders?path="+url.QueryEscape("a_/")+"&recursive=true",
		nil,
	)
	deleteUnderscoreReq.Header.Set("Authorization", "Bearer dev-token")
	deleteUnderscoreRec := httptest.NewRecorder()
	router.ServeHTTP(deleteUnderscoreRec, deleteUnderscoreReq)
	if deleteUnderscoreRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d, body=%s", deleteUnderscoreRec.Code, deleteUnderscoreRec.Body.String())
	}

	rootEntriesReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/wildcard-bucket/entries", nil)
	rootEntriesReq.Header.Set("Authorization", "Bearer dev-token")
	rootEntriesRec := httptest.NewRecorder()
	router.ServeHTTP(rootEntriesRec, rootEntriesReq)
	if rootEntriesRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", rootEntriesRec.Code, rootEntriesRec.Body.String())
	}

	var rootEntriesBody apiEnvelope[explorerListResponse]
	decodeJSON(t, rootEntriesRec.Body.Bytes(), &rootEntriesBody)
	if len(rootEntriesBody.Data.Items) != 2 {
		t.Fatalf("expected 2 remaining root directories, got %+v", rootEntriesBody.Data.Items)
	}
	if rootEntriesBody.Data.Items[0].Path != "ab/" || rootEntriesBody.Data.Items[1].Path != "ghosts/" {
		t.Fatalf("unexpected remaining directories after underscore delete: %+v", rootEntriesBody.Data.Items)
	}

	deleteMissingWildcardReq := httptest.NewRequest(
		http.MethodDelete,
		"/api/v1/buckets/wildcard-bucket/folders?path="+url.QueryEscape("ghost%/")+"&recursive=true",
		nil,
	)
	deleteMissingWildcardReq.Header.Set("Authorization", "Bearer dev-token")
	deleteMissingWildcardRec := httptest.NewRecorder()
	router.ServeHTTP(deleteMissingWildcardRec, deleteMissingWildcardReq)
	if deleteMissingWildcardRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d, body=%s", deleteMissingWildcardRec.Code, deleteMissingWildcardRec.Body.String())
	}

	ghostEntriesReq := httptest.NewRequest(http.MethodGet, "/api/v1/buckets/wildcard-bucket/entries?prefix="+url.QueryEscape("ghosts/"), nil)
	ghostEntriesReq.Header.Set("Authorization", "Bearer dev-token")
	ghostEntriesRec := httptest.NewRecorder()
	router.ServeHTTP(ghostEntriesRec, ghostEntriesReq)
	if ghostEntriesRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", ghostEntriesRec.Code, ghostEntriesRec.Body.String())
	}

	var ghostEntriesBody apiEnvelope[explorerListResponse]
	decodeJSON(t, ghostEntriesRec.Body.Bytes(), &ghostEntriesBody)
	if len(ghostEntriesBody.Data.Items) != 1 || ghostEntriesBody.Data.Items[0].Path != "ghosts/readme.txt" {
		t.Fatalf("expected ghosts/readme.txt to remain after missing wildcard delete, got %+v", ghostEntriesBody.Data.Items)
	}
}

func TestUploadRejectsReservedFolderMarkerName(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "reserved-bucket")

	req := httptest.NewRequest(http.MethodPut, "/api/v1/buckets/reserved-bucket/objects/docs/.light-oss-folder", strings.NewReader("bad"))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("X-Object-Visibility", "private")
	req.Header.Set("X-Original-Filename", ".light-oss-folder")
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestUploadSizeLimit(t *testing.T) {
	router := newTestRouter(t, 4)

	createBucket(t, router, "limit-bucket")

	req := httptest.NewRequest(http.MethodPut, "/api/v1/buckets/limit-bucket/objects/docs/oversized.txt", strings.NewReader("12345"))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("X-Object-Visibility", "public")
	req.Header.Set("X-Original-Filename", "oversized.txt")
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestUpdateObjectVisibility(t *testing.T) {
	router := newTestRouter(t, 1024)

	createBucket(t, router, "visibility-bucket")
	uploadObject(t, router, "/api/v1/buckets/visibility-bucket/objects/docs/readme.txt", "hello", "private")

	unauthorizedReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/buckets/visibility-bucket/objects/visibility/docs/readme.txt",
		bytes.NewBufferString(`{"visibility":"public"}`),
	)
	unauthorizedReq.Header.Set("Content-Type", "application/json")
	unauthorizedRec := httptest.NewRecorder()
	router.ServeHTTP(unauthorizedRec, unauthorizedReq)
	if unauthorizedRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", unauthorizedRec.Code)
	}

	invalidReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/buckets/visibility-bucket/objects/visibility/docs/readme.txt",
		bytes.NewBufferString(`{"visibility":"internal"}`),
	)
	invalidReq.Header.Set("Authorization", "Bearer dev-token")
	invalidReq.Header.Set("Content-Type", "application/json")
	invalidRec := httptest.NewRecorder()
	router.ServeHTTP(invalidRec, invalidReq)
	if invalidRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d, body=%s", invalidRec.Code, invalidRec.Body.String())
	}
	var invalidBody apiEnvelope[objectResponse]
	decodeJSON(t, invalidRec.Body.Bytes(), &invalidBody)
	if invalidBody.Error == nil || invalidBody.Error.Code != "invalid_visibility" {
		t.Fatalf("expected invalid_visibility error, got %+v", invalidBody.Error)
	}

	notFoundReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/buckets/visibility-bucket/objects/visibility/docs/missing.txt",
		bytes.NewBufferString(`{"visibility":"public"}`),
	)
	notFoundReq.Header.Set("Authorization", "Bearer dev-token")
	notFoundReq.Header.Set("Content-Type", "application/json")
	notFoundRec := httptest.NewRecorder()
	router.ServeHTTP(notFoundRec, notFoundReq)
	if notFoundRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d, body=%s", notFoundRec.Code, notFoundRec.Body.String())
	}

	updatePublicReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/buckets/visibility-bucket/objects/visibility/docs/readme.txt",
		bytes.NewBufferString(`{"visibility":"public"}`),
	)
	updatePublicReq.Header.Set("Authorization", "Bearer dev-token")
	updatePublicReq.Header.Set("Content-Type", "application/json")
	updatePublicRec := httptest.NewRecorder()
	router.ServeHTTP(updatePublicRec, updatePublicReq)
	if updatePublicRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", updatePublicRec.Code, updatePublicRec.Body.String())
	}
	var updatePublicBody apiEnvelope[objectResponse]
	decodeJSON(t, updatePublicRec.Body.Bytes(), &updatePublicBody)
	if updatePublicBody.Data.Visibility != "public" {
		t.Fatalf("expected visibility public, got %q", updatePublicBody.Data.Visibility)
	}

	updatePrivateReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/buckets/visibility-bucket/objects/visibility/docs/readme.txt",
		bytes.NewBufferString(`{"visibility":"private"}`),
	)
	updatePrivateReq.Header.Set("Authorization", "Bearer dev-token")
	updatePrivateReq.Header.Set("Content-Type", "application/json")
	updatePrivateRec := httptest.NewRecorder()
	router.ServeHTTP(updatePrivateRec, updatePrivateReq)
	if updatePrivateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", updatePrivateRec.Code, updatePrivateRec.Body.String())
	}
	var updatePrivateBody apiEnvelope[objectResponse]
	decodeJSON(t, updatePrivateRec.Body.Bytes(), &updatePrivateBody)
	if updatePrivateBody.Data.Visibility != "private" {
		t.Fatalf("expected visibility private, got %q", updatePrivateBody.Data.Visibility)
	}
}

func newTestRouter(t *testing.T, maxUploadSize int64) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Bucket{}, &model.Object{}); err != nil {
		t.Fatalf("migrate sqlite: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("sql db: %v", err)
	}

	root := t.TempDir()
	cfg := config.Config{
		AppEnv:                     "development",
		AppAddr:                    ":0",
		PublicBaseURL:              "http://example.com",
		StorageRoot:                filepath.ToSlash(root),
		MaxUploadSizeBytes:         maxUploadSize,
		MaxMultipartMemoryBytes:    8 * 1024 * 1024,
		RateLimitRPS:               1000,
		RateLimitBurst:             1000,
		CORSAllowedOrigins:         []string{"http://localhost:3000"},
		BearerTokens:               []string{"dev-token"},
		SigningSecret:              "test-secret",
		DefaultSignedURLTTLSeconds: 300,
		MaxSignedURLTTLSeconds:     86400,
	}

	bucketRepo := repository.NewBucketRepository(db)
	objectRepo := repository.NewObjectRepository(db)
	localStorage := storage.NewLocalStorage(root)
	return handler.NewRouter(handler.Dependencies{
		Config:        cfg,
		Logger:        zap.NewNop(),
		DB:            sqlDB,
		GormDB:        db,
		AuthValidator: middleware.NewTokenValidator(cfg.BearerTokens),
		BucketService: service.NewBucketService(bucketRepo),
		ObjectService: service.NewObjectService(bucketRepo, objectRepo, localStorage),
		SignService:   service.NewSignService(signing.NewSigner(cfg.SigningSecret), cfg.PublicBaseURL, cfg.DefaultSignedURLTTLSeconds, cfg.MaxSignedURLTTLSeconds),
	})
}

func createBucket(t *testing.T, router *gin.Engine, name string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/buckets", bytes.NewBufferString(`{"name":"`+name+`"}`))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create bucket expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func uploadObject(t *testing.T, router *gin.Engine, path string, body string, visibility string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("X-Object-Visibility", visibility)
	req.Header.Set("X-Original-Filename", "file.txt")
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func createFolder(t *testing.T, router *gin.Engine, bucket string, prefix string, name string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/buckets/"+bucket+"/folders", bytes.NewBufferString(`{"prefix":"`+prefix+`","name":"`+name+`"}`))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create folder expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func decodeJSON(t *testing.T, body []byte, target any) {
	t.Helper()
	if err := json.Unmarshal(body, target); err != nil {
		t.Fatalf("decode json: %v, body=%s", err, string(body))
	}
}
