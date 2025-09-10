'use client';
import React, { useEffect, useState, Suspense, useCallback, useRef } from 'react';
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
    const [loading, setLoading] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const shareTriggered = useRef(false);

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

    // --- PDF Sharing/Downloading Logic ---
    const handleDownload = useCallback(async () => {
        setLoading(true);
        try {
            const apiUrl = `/api/generar-pdf?${searchParams.toString()}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Error al generar el PDF: ${response.statusText}`);
            }

            const blob = await response.blob();
            if (blob.type !== 'application/pdf') {
                throw new Error('La respuesta recibida no es un PDF.');
            }

            const pdfFilename = sanitizeFilename(searchParams.get('filename'), 'factura.pdf');
            downloadFile(blob, pdfFilename);

        } catch (error) {
            console.error("Error in download process:", error);
            alert(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    const handleShare = useCallback(async () => {
        if (window.location.protocol !== 'https:') {
            alert('La función de compartir puede no funcionar correctamente en un entorno local (HTTP). Para una funcionalidad completa, por favor, acceda a esta página a través de HTTPS.');
            return;
        }
        setLoading(true);
        try {
            const apiUrl = `/api/generar-pdf?${searchParams.toString()}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Error al generar el PDF: ${response.statusText}`);
            }

            const blob = await response.blob();
            if (blob.type !== 'application/pdf') {
                throw new Error('La respuesta recibida no es un PDF.');
            }

            const pdfFilename = sanitizeFilename(searchParams.get('filename'), 'factura.pdf');
            const pdfFile = new File([blob], pdfFilename, { type: 'application/pdf' });

            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        title: `Factura: ${pdfFilename}`,
                        text: `Adjunto se encuentra la factura ${pdfFilename}`,
                        files: [pdfFile],
                    });
                } catch (error) {
                    if (error instanceof DOMException && error.name === 'AbortError') {
                        console.log('Share action cancelled by user.');
                    } else {
                        console.warn('Share failed:', error);
                        // No fallback to download here
                    }
                }
            } else {
                alert('La función de compartir no es compatible con este navegador.');
            }
        } catch (error) {
            console.error("Error in share process:", error);
            alert(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    // Effect to load data from URL params
    useEffect(() => {
        setDataLoaded(false);
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

        setDataLoaded(true); // Signal that data is loaded
    }, [searchParams]);

    const getColumnAlignment = (index: number, header: string) => {
        if (index === 0 || ['producto', 'articulos'].includes(header.toLowerCase())) return 'text-left';
        if (index === tableHeaders.length - 1) return 'text-right';
        if (tableRows.some(row => (row[header] || '').includes('|'))) return 'text-left';
        return 'text-right';
    };

    return (
        <>
            <div id="loading-overlay" className={loading ? '' : 'hidden'}>
                <div className="spinner"></div>
                <p>Generando PDF, por favor espere...</p>
            </div>

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
                <button id="share-pdf-btn" onClick={handleShare} disabled={loading}>
                    {loading ? 'Generando...' : 'Compartir'}
                </button>
                <button id="download-pdf-btn" onClick={handleDownload} disabled={loading}>
                    {loading ? 'Generando...' : 'Descargar'}
                </button>
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
