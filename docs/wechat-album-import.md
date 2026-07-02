# WeChat Album Import

The supplied mini-program deep link:

```text
#小程序://微商相册/这家店超火你也来看看👉/TWzvlJfextkeq9H
```

is not a public web catalog URL. Public probes of the likely WeChat Album web hosts showed:

- `https://TWzvlJfextkeq9H.wgstores.com/`: public page responds, but says the link is invalid.
- `https://www.wegooooo.com/TWzvlJfextkeq9H`: public page responds, but says the section was not found.
- WeShop product list endpoint `/album/personal/all?...`: returns `登录已过期，请重新登录。` without a valid session.

Do not crawl authenticated/private APIs. Use an export from WeChat Album instead.

## Import From Export

```bash
npm run import:wechat-album -- \
  --export /path/to/wechat-album-export.xlsx \
  --images /path/to/local/images
```

Supported export formats:

- `.csv`
- `.xlsx`

Useful columns:

- Product number: `product_number`, `sku`, `货号`, `款号`, `商品编号`, `搜索码`
- Brand: `brand`, `品牌`
- Collection: `collection`, `系列`, `分类`
- Series: `series`, `款式`
- Version: `version`, `版本`
- Description: `description`, `描述`, `商品描述`
- Image paths or URLs: `images`, `图片`, `图片路径`, `图片链接`

Image matching:

- Explicit image paths/URLs from the export are used first.
- A folder named after the product number is scanned.
- Filenames containing the product number are also matched.

The importer merges into the current Yupoo catalog, deduplicates by product number, preserves `Brand -> Collection -> Version -> Product`, copies local images to `public/wechat-album/`, and keeps `publicPriceLabel` as `Price on Request`.

## Probe A Public URL

```bash
npm run import:wechat-album -- --source-url "https://example.wgstores.com/weshop/store/SHOP_ID"
```

If the URL requires login or only exposes an app shell without public product data, the importer stops and reports that a CSV/XLSX export is needed.
