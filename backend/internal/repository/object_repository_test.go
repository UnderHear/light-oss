package repository

import (
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"light-oss/backend/internal/model"
)

func TestLikePrefixPatternUsesPortableEscapeCharacter(t *testing.T) {
	got := likePrefixPattern(`LOVE/%_!\docs`)
	want := `LOVE/!%!_!!\docs%`
	if got != want {
		t.Fatalf("unexpected like prefix pattern: got %q want %q", got, want)
	}
}

func TestApplyObjectKeyPrefixFilterUsesPortableEscapeClause(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{DryRun: true})
	if err != nil {
		t.Fatalf("open dry-run db: %v", err)
	}

	stmt := applyObjectKeyPrefixFilter(db.Model(&model.Object{}), "LOVE/%_!").
		Order("object_key ASC").
		Find(&[]model.Object{}).
		Statement

	sql := stmt.SQL.String()
	if !strings.Contains(sql, "ESCAPE '!'") {
		t.Fatalf("expected portable escape clause, got %q", sql)
	}
	if strings.Contains(sql, `ESCAPE '\'`) {
		t.Fatalf("unexpected mysql-incompatible escape clause in %q", sql)
	}
	if len(stmt.Vars) != 1 {
		t.Fatalf("expected 1 query var, got %d", len(stmt.Vars))
	}
	if got, ok := stmt.Vars[0].(string); !ok || got != `LOVE/!%!_!!%` {
		t.Fatalf("unexpected pattern var %#v", stmt.Vars[0])
	}
}
