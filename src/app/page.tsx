'use client';
import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// --- Helper Functions ---
function styleContent(textContent: string | null): string {
    if (!textContent || String(textContent).trim() === '') return '';
    const lines = String(textContent).split('\n');
    return lines.map(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
            const labelPart = line.substring(0, colonIndex + 1);
            const valuePart = line.substring(colonIndex + 1);
            return `<strong class="dynamic-label">${labelPart.trim()}</strong>${valuePart}`;
        }
        return line;
    }).join('<br>');
}

const sanitizeFilename = (filename: string | null, defaultName: string) => {
    if (!filename) return defaultName;
    const sanitized = filename.replace(/[\\/:*?"<>|]/g, '').trim();
    return sanitized ? (sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`) : defaultName;
};

const downloadFile = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

interface TableRow { [key: string]: string; }

const InvoiceContent = () => {
    const searchParams = useSearchParams();
    
    // ++ NEW: States for background PDF generation
    const [backgroundPdfStatus, setBackgroundPdfStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
    const [backgroundPdfUrl, setBackgroundPdfUrl] = useState<string>('');
    const [isDataLoaded, setIsDataLoaded] = useState(false); // Track if initial data is loaded
    // -- END NEW

    const [isShareSupported, setIsShareSupported] = useState(false);

    // --- State Variables ---
    const [theme, setTheme] = useState('');
    const [logo1, setLogo1] = useState('');
    const [logo2, setLogo2] = useState('');
    const [facturaContent, setFacturaContent] = useState('');
    const [fecha, setFecha] = useState('');
    const [hora, setHora] = useState('');
    const [formaPago, setFormaPago] = useState('');
    const [deContent, setDeContent] = useState('');
    const [paraContent, setParaContent] = useState('');
    const [tableHeaders, setTableHeaders] = useState<string[]>([]);
    const [tableRows, setTableRows] = useState<TableRow[]>([]);
    const [subtotal, setSubtotal] = useState('');
    const [descuento, setDescuento] = useState('');
    const [ivaLabel, setIvaLabel] = useState('');
    const [ivaValue, setIvaValue] = useState('');
    const [total, setTotal] = useState('');
    const [nota, setNota] = useState('');
    const [showPrintFooter, setShowPrintFooter] = useState(false);
    const [footerInfo, setFooterInfo] = useState('');
    const [printDate, setPrintDate] = useState('');
    const [footerNota, setFooterNota] = useState('');
    const [sumDataLines, setSumDataLines] = useState<{label: string, value: string}[]>([]);
    const [totalDataLines, setTotalDataLines] = useState<{label: string, value: string}[]>([]);

    // --- PDF Downloading & Sharing Logic ---
    useEffect(() => {
        if (typeof window !== "undefined" && "share" in navigator) {
            setIsShareSupported(true);
        }
    }, []);

    const handleDownload = useCallback(() => {
        if (backgroundPdfStatus !== 'ready' || !backgroundPdfUrl) return;

        console.log('LOG: Usando PDF pre-generado en memoria para descargar.');
        const pdfFilename = sanitizeFilename(searchParams.get('filename'), 'factura.pdf');
        
        const link = document.createElement('a');
        link.href = backgroundPdfUrl;
        link.download = pdfFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [searchParams, backgroundPdfStatus, backgroundPdfUrl]);

    const handleShare = useCallback(async () => {
        if (backgroundPdfStatus !== 'ready' || !backgroundPdfUrl) return;

        if (!navigator.share) {
            alert('La función de compartir no está disponible en este navegador.');
            return;
        }

        console.log('LOG: Usando PDF pre-generado en memoria para compartir.');
        try {
            const response = await fetch(backgroundPdfUrl);
            const blob = await response.blob();
            const pdfFilename = sanitizeFilename(searchParams.get('filename'), 'factura.pdf');
            const file = new File([blob], pdfFilename, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: pdfFilename,
                    text: `Factura: ${pdfFilename}`,
                });
            } else {
                alert('Este navegador no admite compartir archivos. Intenta descargar el archivo y compartirlo manualmente.');
            }

        } catch (error) {
            console.error("Error in share process with pre-generated PDF:", error);
            if (error instanceof Error && error.name !== 'AbortError') {
                alert(error.message);
            } else if (!(error instanceof Error)) {
                alert(String(error));
            }
        }
    }, [searchParams, backgroundPdfUrl, backgroundPdfStatus]);

    // ++ NEW: Background PDF Generation Logic
    const handleBackgroundPdfGeneration = useCallback(async () => {
        console.log('LOG: Iniciando generación de PDF en segundo plano...');
        setBackgroundPdfStatus('generating');

        try {
            console.log('LOG: Parámetros enviados para generación en segundo plano.');
            
            const response = await fetch('/api/generar-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ params: searchParams.toString() }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`LOG: Error en la API al generar PDF en segundo plano. Status: ${response.status}`, errorText);
                throw new Error(`Error al generar el PDF: ${response.statusText}`);
            }
            console.log('LOG: Respuesta de la API para PDF en segundo plano recibida correctamente.');

            const blob = await response.blob();
            if (blob.type !== 'application/pdf') {
                console.error('LOG: La respuesta recibida no es un PDF, sino:', blob.type);
                throw new Error('La respuesta recibida no es un PDF.');
            }

            const url = URL.createObjectURL(blob);
            setBackgroundPdfUrl(url);
            setBackgroundPdfStatus('ready');
            console.log('LOG: PDF en segundo plano generado y listo en memoria. URL:', url);

        } catch (error) {
            console.error("LOG: Error durante la generación de PDF en segundo plano:", error);
            setBackgroundPdfStatus('error');
        }
    }, [searchParams]);
    // -- END NEW

    // Effect to load data from URL params
    useEffect(() => {
        const themeParam = searchParams.get('tema');
        document.body.className = '';
        if (themeParam === 'PurpuraGrad') document.body.classList.add('theme-purpura');
        else if (themeParam === 'AzulAbstractPro') document.body.classList.add('theme-azul');
        else if (themeParam === 'AzulAbstractProHF') document.body.classList.add('theme-azul', 'use-hf-azul');
        else document.body.classList.add('bg-gray-100');
        setTheme(themeParam || 'default');

        const defaultLogo1Url = 'https://raw.githubusercontent.com/Francisco05c/Plantilla_HTML_Factura_Documento/a35577462b664ba92d33755a7279a335a06b4243/Logo.svg';
        const logo1Param = searchParams.get('Logo1');
        const logo2Param = searchParams.get('Logo2');
        setLogo1(logo1Param !== null ? (logo1Param.trim() ? logo1Param : '') : defaultLogo1Url);
        setLogo2(logo2Param !== null ? (logo2Param.trim() ? logo2Param : '') : '');

        setFacturaContent(styleContent(searchParams.get('Factura')));
        setFecha(searchParams.get('Fecha') || '');
        setHora(searchParams.get('Hora') || '');
        setFormaPago(searchParams.get('FormaPago') || '');
        setDeContent(styleContent(searchParams.get('De')));
        setParaContent(styleContent(searchParams.get('Cliente')));

        const sumDataParam = searchParams.get('SumDataLine');
        if (sumDataParam) {
            const lines = sumDataParam.split('\n').map(line => {
                const parts = line.split(':');
                return {
                    label: parts[0] ? parts[0].trim() + ':' : '',
                    value: parts[1] ? parts[1].trim() : ''
                };
            }).filter(line => line.label);
            setSumDataLines(lines);
        } else {
            setSumDataLines([]);
        }

        const totalDataParam = searchParams.get('TotalDataLine');
        if (totalDataParam) {
            const lines = totalDataParam.split('\n').map(line => {
                const parts = line.split(':');
                return {
                    label: parts[0] ? parts[0].trim() + ':' : '',
                    value: parts[1] ? parts[1].trim() : ''
                };
            }).filter(line => line.label);
            setTotalDataLines(lines);
        } else {
            setTotalDataLines([]);
        }

        const columnNames = searchParams.getAll('columna');
        setTableHeaders(columnNames);
        if (columnNames.length > 0) {
            const firstColData = (searchParams.get(columnNames[0]) || '').split(',');
            const numRows = firstColData[0].trim() !== '' ? firstColData.length : 0;
            const rows: TableRow[] = Array.from({ length: numRows }, (_, i) => {
                const row: TableRow = {};
                columnNames.forEach(colName => {
                    const colData = (searchParams.get(colName) || '').split(',');
                    row[colName] = (colData[i] || '').trim();
                });
                return row;
            });
            setTableRows(rows);
        } else {
            setTableRows([]);
        }

        setSubtotal(searchParams.get('Subtotal') || '');
        setDescuento(searchParams.get('Descuento') || '');
        setIvaLabel(searchParams.get('IVALine') || '');
        setIvaValue(searchParams.get('IVAMonto') || '');
        setTotal(searchParams.get('Total') || '');
        setNota(searchParams.get('Nota') || '');

        const notaP = searchParams.get('NotaP');
        if (notaP) {
            setShowPrintFooter(true);
            const facturaLines = (searchParams.get('Factura') || '').split('\n');
            const clienteLines = (searchParams.get('Cliente') || '').split('\n');
            const infoParts: string[] = [];
            if (facturaLines.length > 0 && facturaLines[0].trim()) infoParts.push(facturaLines[0].trim());
            if (clienteLines.length > 0 && clienteLines[0].trim()) infoParts.push(clienteLines[0].trim());
            setFooterInfo(infoParts.join(' - '));
            const now = new Date();
            const locale = 'es-ES';
            const dateOptions:Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
            const timeOptions:Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
            setPrintDate(`${now.toLocaleDateString(locale, dateOptions)} ${now.toLocaleTimeString(locale, timeOptions)}`);
            setFooterNota(notaP);
        } else {
            setShowPrintFooter(false);
        }

        // Mark that the initial data loading from URL is complete
        setIsDataLoaded(true);
        
    }, [searchParams]);

    // ++ NEW: Effect to trigger background PDF generation AFTER data is loaded
    useEffect(() => {
        // Only trigger generation if data is loaded AND we are not in a print job from the server
        if (isDataLoaded && searchParams.toString() && !searchParams.has('isPrinting')) {
            handleBackgroundPdfGeneration();
        }
    }, [isDataLoaded, searchParams, handleBackgroundPdfGeneration]);

    // ++ NEW: Cleanup effect for Blob URL
    useEffect(() => {
        // This function will be called when the component unmounts
        return () => {
            if (backgroundPdfUrl) {
                console.log('LOG: Limpiando URL del PDF en memoria para evitar fugas:', backgroundPdfUrl);
                URL.revokeObjectURL(backgroundPdfUrl);
            }
        };
    }, [backgroundPdfUrl]);
    // -- END NEW

    // Effect to scroll to buttons after PDF generation
    useEffect(() => {
        if (backgroundPdfStatus === 'ready') {
            const scrollTo = searchParams.get('scrollTo');
            if (scrollTo === 'buttons') {
                const buttonContainer = document.querySelector('.button-container');
                if (buttonContainer) {
                    // Adding a small delay to ensure the DOM is fully updated
                    setTimeout(() => {
                        buttonContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            }
        }
    }, [backgroundPdfStatus, searchParams]);

    const getColumnAlignment = (index: number, header: string) => {
        if (index === 0 || ['producto', 'articulos'].includes(header.toLowerCase())) return 'text-left';
        if (index === tableHeaders.length - 1) return 'text-right';
        if (tableRows.some(row => (row[header] || '').includes('|'))) return 'text-left';
        return 'text-right';
    };

    return (
        <>
            {/* Print-only headers (conditionally rendered by CSS) */}
            <div id="print-header-azul" className="print-only"></div>
            
            <div className="invoice-wrapper">
                <div className="invoice-container">
                    {theme === 'AzulAbstractProHF' && <div id="screen-header-azul" className="screen-only-decoration"></div>}
                    <div className="invoice-header">
                        <div className="header-left">
                            {logo1 && <div className="logo" id="logo1"><img src={logo1} alt="Logo 1"/></div>}
                            {logo2 && <div className="logo" id="logo2"><img src={logo2} alt="Logo 2"/></div>}
                        </div>
                        <div className="header-right">
                            {facturaContent && <div id="factura-line" className="detail-line" dangerouslySetInnerHTML={{ __html: facturaContent }}></div>}
                            {fecha && <div id="fecha-line" className = "detail-line"><strong>Fecha:</strong> <span id="fecha">{fecha}</span></div>}
                            {hora && <div id="hora-line" className="detail-line"><strong>Hora:</strong> <span id="hora">{hora}</span></div>}
                            {formaPago && <div id="forma-pago-line" className="detail-line"><strong>Forma de Pago:</strong> <span id="forma-pago">{formaPago}</span></div>}
                        </div>
                    </div>
                    <div className="sender-receiver-details">
                        {deContent && <div id="de-section" className="info-section" dangerouslySetInnerHTML={{ __html: deContent }}></div>}
                        {paraContent && <div id="para-section" className="info-section" dangerouslySetInnerHTML={{ __html: paraContent }}></div>}
                    </div>
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                {tableHeaders.map((header, index) => <th key={index} className={getColumnAlignment(index, header)}>{header}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.length > 0 ? (
                                tableRows.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {tableHeaders.map((header, colIndex) => <td key={colIndex} className={getColumnAlignment(colIndex, header)} dangerouslySetInnerHTML={{ __html: (row[header] || '').replace(/\|/g, '<br>') }}></td>)}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableHeaders.length || 1} style={{ textAlign: 'center', padding: '20px' }}>
                                        {tableHeaders.length > 0 ? "No hay elementos para mostrar." : "No se ha definido la estructura de la tabla."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="summary-and-notes-container">
                        <div className="invoice-summary">
                            {sumDataLines.map((line, index) => (
                                <div key={index} className="summary-line">
                                    <span>{line.label}</span>
                                    <span>{line.value}</span>
                                </div>
                            ))}
                            {subtotal && <div id="subtotal-line" className="summary-line"><span>Subtotal:</span><span id="subtotal">{subtotal}</span></div>}
                            {descuento && <div id="descuento-line" className="summary-line"><span>Descuento:</span><span id="descuento">{descuento}</span></div>}
                            {(ivaLabel || ivaValue) && <div id="iva-label-line" className="summary-line"><span>IVA ({ivaLabel}):</span><span id="iva-label-value">{ivaValue}</span></div>}
                                                        {totalDataLines.map((line, index) => (
                                <div key={index} className="summary-line total-line">
                                    <span>{line.label}</span>
                                    <span>{line.value}</span>
                                </div>
                            ))}
                            {total && !totalDataLines.length && <div id="total-line" className="summary-line total-line"><span>Total:</span><span id="total">{total}</span></div>}
                        </div>
                        {nota && <div id="nota-section" className="invoice-note"><strong>Nota:</strong> <span id="nota" dangerouslySetInnerHTML={{ __html: nota }}></span></div>}
                    </div>
                    {theme === 'AzulAbstractProHF' && <div id="screen-footer-azul" className="screen-only-decoration"><div className="deco-skew"></div></div>}
                </div>
            </div>

            <div className="button-container no-print">
                <button id="download-pdf-btn" onClick={handleDownload} disabled={backgroundPdfStatus !== 'ready'}>
                    {
                        {
                            idle: 'Preparando...',
                            generating: 'Generando...',
                            ready: 'Descargar',
                            error: 'Error'
                        }[backgroundPdfStatus] || 'Descargar'
                    }
                </button>
                {isShareSupported && (
                    <button id="share-pdf-btn" onClick={handleShare} disabled={backgroundPdfStatus !== 'ready'}>
                        {
                            {
                                idle: 'Preparando...',
                                generating: 'Generando...',
                                ready: 'Compartir',
                                error: 'Error'
                            }[backgroundPdfStatus] || 'Compartir'
                        }
                    </button>
                )}
            </div>

            {showPrintFooter && (
                <div className="print-footer print-only" id="print-footer">
                    <p id="footer-company-info">{footerInfo}</p>
                    <p>Fecha de impresión: <span id="print-date">{printDate}</span></p>
                    {footerNota && <p id="footer-notap-content" style={{fontStyle: 'italic'}}>{footerNota}</p>}
                </div>
            )}
        </>
    );
};

export default function Home() {
  return (
    <Suspense fallback={<div>Cargando Factura...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}