# WeCatalog Media Backfill Report

Generated at: 2026-07-20T10:58:27Z

## Summary

- Total products scanned: 65,649
- Products containing videos: 4,205
- Total videos discovered: 4,205
- Videos successfully imported or preserved: 4,056
- Failed or inaccessible videos: 149
- Failed product detail scans: 3
- Duplicate poster-image records removed: 3,615

## Media Model

```json
{
  "type": "image | video",
  "url": "string",
  "poster": "video poster only",
  "sourceMediaId": "string"
}
```

## Notes

- Product classifications were not changed.
- Category mappings were not changed.
- Valid image galleries were preserved.
- Video posters are preserved as `poster` on video media records.
- A poster is not duplicated as a normal gallery image when it matches the source video poster.
