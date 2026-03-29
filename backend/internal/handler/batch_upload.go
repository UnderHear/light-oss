package handler

import (
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"

	apperrors "light-oss/backend/internal/pkg/errors"
	"light-oss/backend/internal/pkg/response"
	"light-oss/backend/internal/service"
)

type uploadBatchManifestItemRequest struct {
	FileField    string `json:"file_field"`
	RelativePath string `json:"relative_path"`
}

type uploadBatchResponse struct {
	UploadedCount int              `json:"uploaded_count"`
	Items         []objectResponse `json:"items"`
}

func (h *apiHandler) uploadObjectBatch(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(h.cfg.MaxMultipartMemoryBytes); err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			response.Error(c, apperrors.New(http.StatusRequestEntityTooLarge, "payload_too_large", "request body exceeds configured upload size"))
			return
		}

		response.Error(c, apperrors.New(http.StatusBadRequest, "invalid_multipart_request", "multipart form is invalid"))
		return
	}

	form := c.Request.MultipartForm
	if form == nil {
		response.Error(c, apperrors.New(http.StatusBadRequest, "invalid_multipart_request", "multipart form is invalid"))
		return
	}
	defer func() {
		_ = form.RemoveAll()
	}()

	manifest, err := parseUploadBatchManifest(form)
	if err != nil {
		response.Error(c, err)
		return
	}

	seenFileFields := make(map[string]struct{}, len(manifest))
	items := make([]service.UploadObjectBatchItemInput, 0, len(manifest))
	for _, entry := range manifest {
		fileField := strings.TrimSpace(entry.FileField)
		relativePath := strings.TrimSpace(entry.RelativePath)
		if fileField == "" || relativePath == "" {
			response.Error(c, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest entry is invalid"))
			return
		}
		if _, exists := seenFileFields[fileField]; exists {
			response.Error(c, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest contains duplicate file fields"))
			return
		}
		seenFileFields[fileField] = struct{}{}

		fileHeader, err := getSingleMultipartFile(form, fileField)
		if err != nil {
			response.Error(c, err)
			return
		}

		currentFileHeader := fileHeader
		originalFilename := strings.TrimSpace(currentFileHeader.Filename)
		if originalFilename == "" {
			originalFilename = path.Base(relativePath)
		}

		items = append(items, service.UploadObjectBatchItemInput{
			RelativePath:     relativePath,
			OriginalFilename: originalFilename,
			ContentType:      currentFileHeader.Header.Get("Content-Type"),
			Open: func() (io.ReadCloser, error) {
				file, err := currentFileHeader.Open()
				if err != nil {
					return nil, err
				}

				return file, nil
			},
		})
	}

	result, err := h.objectService.UploadBatch(c.Request.Context(), service.UploadObjectBatchInput{
		BucketName: c.Param("bucket"),
		Prefix:     firstMultipartValue(form.Value, "prefix"),
		Visibility: firstMultipartValue(form.Value, "visibility"),
		Items:      items,
	})
	if err != nil {
		response.Error(c, err)
		return
	}

	objects := make([]objectResponse, 0, len(result.Items))
	for _, item := range result.Items {
		objects = append(objects, objectToResponse(item))
	}

	response.JSON(c, http.StatusCreated, uploadBatchResponse{
		UploadedCount: result.UploadedCount,
		Items:         objects,
	})
}

func parseUploadBatchManifest(form *multipart.Form) ([]uploadBatchManifestItemRequest, error) {
	rawManifest := firstMultipartValue(form.Value, "manifest")
	if strings.TrimSpace(rawManifest) == "" {
		return nil, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest is required")
	}

	var manifest []uploadBatchManifestItemRequest
	if err := json.Unmarshal([]byte(rawManifest), &manifest); err != nil {
		return nil, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest is invalid")
	}
	if len(manifest) == 0 {
		return nil, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest must contain at least one file")
	}

	return manifest, nil
}

func getSingleMultipartFile(form *multipart.Form, fileField string) (*multipart.FileHeader, error) {
	files := form.File[fileField]
	if len(files) == 0 {
		return nil, apperrors.New(http.StatusBadRequest, "batch_file_missing", "manifest references a missing file")
	}
	if len(files) > 1 {
		return nil, apperrors.New(http.StatusBadRequest, "invalid_batch_manifest", "manifest must reference exactly one file per field")
	}

	return files[0], nil
}

func firstMultipartValue(values map[string][]string, key string) string {
	items := values[key]
	if len(items) == 0 {
		return ""
	}

	return strings.TrimSpace(items[0])
}
