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

export async function POST(request: NextRequest) {
  const { params } = await request.json();
  if (!params) {
    return new NextResponse("Faltan parámetros en la solicitud.", { status: 400 });
  }

  const puppeteerParams = new URLSearchParams(params);
  puppeteerParams.delete('compartir'); // Remove the share trigger to prevent loops
  puppeteerParams.set('isPrinting', 'true'); // Add a flag for the frontend to know it's a print job

  // Reconstruct the frontend URL from the incoming request
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const frontendUrl = `${protocol}://${host}/?${puppeteerParams.toString()}`;

  // Sanitize the filename
  const desiredFilename = puppeteerParams.get('filename');
  const pdfFilename = sanitizeFilename(desiredFilename, 'factura.pdf');

  let browser;
  try {
    console.log("LOG (API): Iniciando Puppeteer...");
    // Determine correct puppeteer import based on environment
    const isVercel = !!process.env.VERCEL_ENV;
    const pptr = isVercel ? puppeteer : (await import("puppeteer")) as unknown as typeof puppeteer;

    // Launch Puppeteer
    browser = await pptr.launch(isVercel ? {
      args: pptr.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    } : { 
      headless: "shell",
      // Added for compatibility in some environments
      args: [...pptr.defaultArgs(), '--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("LOG (API): Navegador Puppeteer lanzado correctamente.");

    const page = await browser.newPage();
    console.log("LOG (API): Nueva página creada.");

    console.log(`LOG (API): Navegando a la URL: ${frontendUrl}`);
    // Visit the reconstructed URL
    await page.goto(frontendUrl, {
      // Changed to domcontentloaded for faster loading and to avoid timeouts.
      // If images or styles are missing, 'networkidle2' is a good alternative.
            waitUntil: 'networkidle0',
      timeout: 60000 // Aumentamos el timeout a 60 segundos
    });

    console.log("LOG (API): Página cargada. Generando PDF...");
    // Generate the PDF
    const pdf = await page.pdf({
        path: undefined,
        printBackground: true,
        format: 'A4'
    });
    console.log("LOG (API): PDF generado. Enviando respuesta...");
    // Return the PDF as a response
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdfFilename}"`, 
      },
    });
  } catch (error) {
    console.error("LOG (API): Error detallado en el backend:", error);
    return new NextResponse(
      "An error occurred while generating the PDF.",
      { status: 500 }
    );
  } finally {
    if (browser) {
      console.log("LOG (API): Cerrando el navegador.");
      await browser.close();
    }
  }
}
