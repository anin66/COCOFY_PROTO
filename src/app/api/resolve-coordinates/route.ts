import { NextResponse } from "next/server";
import { parseCoordinates, extractCoordinatesFromHtml } from "@/lib/locationUtils";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Server-side fetch will follow redirects and give us the final URL containing coordinates
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const finalUrl = response.url;
    const coords = parseCoordinates(finalUrl);

    if (coords) {
      return NextResponse.json(coords);
    }

    // Fallback: If not in URL, check location header
    const redirectUrl = response.headers.get("location");
    if (redirectUrl) {
      const redirectCoords = parseCoordinates(redirectUrl);
      if (redirectCoords) {
        return NextResponse.json(redirectCoords);
      }
    }

    // Fallback 2: Check the response HTML content (e.g. static maps, preview URLs or embedded data)
    try {
      const html = await response.text();
      const htmlCoords = extractCoordinatesFromHtml(html);
      if (htmlCoords) {
        return NextResponse.json(htmlCoords);
      }
    } catch (e) {
      console.error("Error reading HTML content of Maps page:", e);
    }

    return NextResponse.json(
      { error: "Could not extract coordinates from the resolved URL: " + finalUrl },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error resolving maps URL:", error);
    return NextResponse.json({ error: "Failed to resolve coordinates from URL." }, { status: 500 });
  }
}
