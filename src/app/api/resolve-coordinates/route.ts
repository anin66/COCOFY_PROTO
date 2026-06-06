import { NextResponse } from "next/server";
import { parseCoordinates, extractCoordinatesFromHtml } from "@/lib/locationUtils";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let currentUrl = url.trim();
    let coords = parseCoordinates(currentUrl, true); // Ignore camera coordinates

    if (coords) {
      return NextResponse.json(coords);
    }

    let steps = 0;
    const maxSteps = 5;
    let lastFetchedUrl = currentUrl;
    let finalHtml = "";

    while (steps < maxSteps) {
      steps++;
      try {
        const response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        lastFetchedUrl = currentUrl;
        
        // 1. Try parsing coordinates from the current URL (ignore camera coordinates)
        coords = parseCoordinates(currentUrl, true);
        if (coords) {
          return NextResponse.json(coords);
        }

        const location = response.headers.get("location");
        if (!location) {
          // No more redirects. Read HTML to see if coordinates are in page content (if not a consent page)
          if (!currentUrl.includes("consent.google.com")) {
            finalHtml = await response.text();
            coords = extractCoordinatesFromHtml(finalHtml);
            if (coords) {
              return NextResponse.json(coords);
            }
          }
          break;
        }

        // Resolve relative redirect URL
        const nextUrl = new URL(location, currentUrl).toString();

        // 2. Try parsing coordinates from the redirect Location URL (ignore camera coordinates)
        coords = parseCoordinates(nextUrl, true);
        if (coords) {
          return NextResponse.json(coords);
        }

        // If redirecting to Google Consent screen, decode and parse coordinates from the nextUrl
        if (nextUrl.includes("consent.google.com")) {
          const decodedNextUrl = decodeURIComponent(nextUrl);
          coords = parseCoordinates(decodedNextUrl, true);
          if (coords) {
            return NextResponse.json(coords);
          }
          break;
        }

        currentUrl = nextUrl;
      } catch (err) {
        console.error(`Error during manual redirect step ${steps}:`, err);
        break;
      }
    }

    // Fallback: If we still couldn't resolve, fetch the last non-consent URL fully (with redirects)
    if (!lastFetchedUrl.includes("consent.google.com") && !finalHtml) {
      try {
        const response = await fetch(lastFetchedUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        const html = await response.text();
        coords = extractCoordinatesFromHtml(html);
        if (coords) {
          return NextResponse.json(coords);
        }
      } catch (err) {
        console.error("Error in final fallback fetch:", err);
      }
    }

    return NextResponse.json(
      { error: "Could not extract coordinates from the resolved URL: " + lastFetchedUrl },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error resolving maps URL:", error);
    return NextResponse.json({ error: "Failed to resolve coordinates from URL." }, { status: 500 });
  }
}
