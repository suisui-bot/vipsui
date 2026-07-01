import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "photo.yupoo.com";

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing image URL", { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || imageUrl.hostname !== ALLOWED_HOST) {
    return new NextResponse("Unsupported image host", { status: 400 });
  }

  const response = await fetch(imageUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Referer: "https://1688dafan.x.yupoo.com/",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!response.ok || !response.body) {
    return new NextResponse("Image unavailable", { status: response.status || 502 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}
