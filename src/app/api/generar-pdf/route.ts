import { NextRequest, NextResponse } from "next/server";
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Helper function to sanitize filename
const sanitizeFilename = (filename: string | null, defaultName: string) => {
    if (!filename) return defaultName;
    // Remove invalid characters and trim
    const sanitized = filename.replace(/[\\/:*?"<>|]/g, '').trim();
    if (!sanitized) return defaultName;
    // Ensure it ends with .pdf
    return sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Reconstruct the frontend URL from the incoming request
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const frontendUrl = `${protocol}://${host}/?${searchParams.toString()}`;

  // Sanitize the filename
  const desiredFilename = searchParams.get('filename');
  const pdfFilename = sanitizeFilename(desiredFilename, 'factura.pdf');

  let browser;
  try {
    // Determine correct puppeteer import based on environment
    const isVercel = !!process.env.VERCEL_ENV;
    const pptr = isVercel ? puppeteer : (await import("puppeteer")) as unknown as typeof puppeteer;

    // Launch Puppeteer
    browser = await pptr.launch(isVercel ? {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } : { 
      headless: true, 
      args: puppeteer.defaultArgs()
    });

    const page = await browser.newPage();
    
    // Visit the reconstructed URL
    await page.goto(frontendUrl, { waitUntil: 'networkidle0' });

    // Generate the PDF
    const pdf = await page.pdf({
        path: undefined,
        printBackground: true,
        format: 'A4'
    });

    // Return the PDF as a response
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdfFilename}"`, 
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(
      "An error occurred while generating the PDF.",
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
