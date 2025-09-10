# Proyecto: Generador de Facturas en PDF

Este proyecto es una API construida con Next.js y Puppeteer, diseñada para generar dinámicamente documentos PDF a partir de datos de facturas proporcionados a través de parámetros en la URL. La herramienta renderiza una página de factura en el frontend y la convierte en un PDF descargable.

Está optimizado para su despliegue en plataformas sin servidor como Vercel.

## Tabla de Contenidos
1. [Documentación del Backend](#documentación-del-backend)
    - [Propósito](#propósito)
    - [Pila Tecnológica](#pila-tecnológica)
    - [Funcionamiento](#funcionamiento)
    - [Despliegue en Vercel](#despliegue-en-vercel)
2. [Guía de Uso y Parámetros](#guía-de-uso-y-parámetros)
    - [Endpoint de la API](#endpoint-de-la-api)
    - [Parámetros de Usuario](#parámetros-de-usuario)
    - [Ejemplo de Uso](#ejemplo-de-uso)

---

## Documentación del Backend

### Propósito
El backend consiste en una única ruta de API (`/api/generar-pdf`) que actúa como un servicio de renderizado a PDF. En lugar de recibir HTML directamente, toma los parámetros de la URL, los reenvía a la aplicación de frontend para que esta renderice la factura, y luego captura esa página renderizada como un PDF.

### Pila Tecnológica
- **Framework:** Next.js (App Router)
- **Lenguaje:** TypeScript
- **Generación de PDF:** Puppeteer
- **Compatibilidad en Vercel:** `@sparticuz/chromium`
- **Entorno de ejecución:** Node.js

### Funcionamiento
El flujo de trabajo de la API es el siguiente:
1.  **Recepción de la Solicitud:** La API recibe una solicitud `GET` en `/api/generar-pdf`.
2.  **Construcción de URL:** La API reconstruye la URL de la página principal de la factura (`/`) y le añade todos los parámetros que recibió originalmente, además de un parámetro especial: `isPrinting=true`. Este nuevo parámetro le indica al frontend que debe renderizar una versión limpia de la factura, optimizada para impresión (por ejemplo, sin botones ni menús).
3.  **Lanzamiento del Navegador:** Utiliza Puppeteer para lanzar una instancia de un navegador sin cabeza (headless browser). Gracias a `@sparticuz/chromium`, es compatible tanto con el entorno de desarrollo local como con el de producción en Vercel.
4.  **Visita a la Página:** El navegador sin cabeza "visita" la URL de la factura construida en el paso 2. La opción `{ waitUntil: 'networkidle0' }` asegura que la página y todos sus recursos (imágenes, estilos) se hayan cargado completamente.
5.  **Generación del PDF:** Una vez cargada la página, Puppeteer genera un PDF de la vista actual en formato A4 y con fondos de impresión activados.
6.  **Respuesta al Cliente:** La API devuelve el buffer del PDF generado con las cabeceras HTTP adecuadas (`Content-Type: application/pdf`) para que el navegador lo interprete como un archivo PDF descargable o visible en línea.

### Despliegue en Vercel
Para que Puppeteer funcione correctamente en un entorno sin servidor como Vercel, es crucial externalizar las dependencias correctas en la configuración de Next.js.

**`next.config.ts`**:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
```

### Créditos

La estrategia de despliegue en Vercel utilizando `@sparticuz/chromium` se basa en el método descrito en el siguiente artículo, que sirvió como guía fundamental para la implementación del backend:

- **Artículo:** [Deploying an HTML-to-PDF API on Vercel with Puppeteer](https://javascript.plainenglish.io/deploying-an-html-to-pdf-api-on-vercel-with-puppeteer-541d1d871f08) por Ivan Muñoz.

---

## Guía de Uso y Parámetros

### Endpoint de la API
Para generar un PDF, se debe hacer una solicitud `GET` al siguiente endpoint, añadiendo los parámetros que se describen a continuación.
```
/api/generar-pdf
```

### Parámetros de Usuario
El contenido del documento se controla completamente a través de parámetros de consulta en la URL.

---
#### **Parámetros Generales y de Estilo**
| Parámetro | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `filename` | Nombre del archivo PDF final. Si no se especifica, se usa `factura.pdf`. | `&filename=Presupuesto%20Cliente` |
| `tema` | Define el estilo visual del documento. | `&tema=PurpuraGrad` <br/> `&tema=AzulAbstractPro` <br/> `&tema=AzulAbstractProHF` |
| `Logo1` | URL de la imagen para el logo principal. Si se deja en blanco, no se muestra. | `&Logo1=https://url.com/mi_logo.png` |
| `Logo2` | URL de la imagen para un logo secundario. | `&Logo2=https://url.com/otro_logo.svg` |

---
#### **Contenido Principal**
Para estos campos, puedes usar `%0A` para representar saltos de línea. El texto antes del primer `:` en una línea se pondrá en negrita.

| Parámetro | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `Factura` | Bloque de texto para el título y número del documento. | `&Factura=Factura%20Nro:%2000123` |
| `Fecha` | Fecha del documento. | `&Fecha=10/09/2025` |
| `Hora` | Hora del documento. | `&Hora=14:30` |
| `FormaPago` | Método de pago. | `&FormaPago=Transferencia` |
| `De` | Bloque de texto para los datos del emisor. | `&De=Mi%20Empresa%0ACalle%20Falsa%20123` |
| `Cliente` | Bloque de texto para los datos del receptor/cliente. | `&Cliente=Cliente%20Final%0AAv.%20Siempreviva%20742` |
| `Nota` | Notas o comentarios adicionales al final del documento. | `&Nota=Garantía%20válida%20por%2030%20días.` |

---
#### **Datos de la Tabla (Codificación Especial)**
La tabla de ítems se construye de forma dinámica.

1.  **Define las columnas:** Usa el parámetro `columna` una vez por cada encabezado de la tabla. El orden se respeta.
2.  **Provee los datos:** Para cada nombre de columna que definiste, crea un parámetro con ese mismo nombre que contenga los valores de esa columna para cada fila, **separados por comas**.

| Parámetro | Descripción |
| :--- | :--- |
| `columna` | (Repetible) Define el nombre de un encabezado de columna. |
| `[nombre_columna]` | Una vez definidas las columnas, se usa un parámetro con el mismo nombre para listar los datos de esa columna, separados por comas. |

**Ejemplo de Tabla:**
Para una tabla con columnas "Cant.", "Descripción" y "Total":
```
&columna=Cant.&columna=Descripción&columna=Total&Cant.=1,2&Descripción=Producto%20A,Producto%20B&Total=100,200
```
Esto creará una tabla con dos filas.

---
#### **Resumen y Totales**
| Parámetro | Descripción | Formato y Ejemplo |
| :--- | :--- | :--- |
| `SumDataLine` | Líneas personalizadas de resumen (antes de Subtotal). | Múltiples líneas separadas por `%0A`. Cada línea es `Clave:Valor`.<br/>`&SumDataLine=Base%20Imponible:%201000%0AEnvío:%2050` |
| `Subtotal` | Monto del subtotal. | `&Subtotal=1050` |
| `Descuento` | Monto del descuento. | `&Descuento=50` |
| `IVALine` | Etiqueta para la línea de IVA (ej. el porcentaje). | `&IVALine=21%` |
| `IVAMonto` | Monto del IVA. | `&IVAMonto=210` |
| `TotalDataLine` | Líneas personalizadas para el total final. Reemplaza al parámetro `Total`. | Múltiples líneas separadas por `%0A`. Cada línea es `Clave:Valor`.<br/>`&TotalDataLine=Total%20USD:%201210%0ATotal%20EUR:%201150` |
| `Total` | Monto final. Se ignora si se usa `TotalDataLine`. | `&Total=1210` |

---
#### **Parámetros de Acción y Pie de Página**
| Parámetro | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `NotaP` | Si se incluye, activa un pie de página especial para impresión con fecha, hora y datos del documento. El valor de este parámetro será el texto que se muestre. | `&NotaP=Documento%20no%20válido%20como%20factura` |
| `compartir` | Si se establece en `true`, intenta abrir el diálogo de "Compartir" del navegador con el PDF generado en cuanto se carga la página. | `&compartir=true` |

### Ejemplo de Uso Completo
Esta URL genera un documento con dos logos, tema púrpura, una tabla con 3 ítems y un pie de página personalizado.

```
https://<tu-dominio>.vercel.app/api/generar-pdf?filename=Factura-001&tema=PurpuraGrad&Logo1=https://raw.githubusercontent.com/Francisco05c/Plantilla_HTML_Factura_Documento/main/Logo.svg&Logo2=https://raw.githubusercontent.com/Francisco05c/Plantilla_HTML_Factura_Documento/main/Qr.svg&Factura=Factura%20Nro:%20001&Fecha=10/09/2025&De=Tu%20Empresa%20S.L.%0ACIF:%20B12345678%0ACalle%20Principal%201%0A28001%20Madrid,%20España&Cliente=Cliente%20de%20Ejemplo%0ANIF:%20A87654321%0AAv.%20Secundaria%202%0A08001%20Barcelona,%20España&columna=Descripción&columna=Cant.&columna=Precio%20Unit.&columna=Total&Descripción=Desarrollo%20Web,Diseño%20Gráfico,Hosting%20Anual&Cant.=1,10,1&Precio%20Unit.=1500,50,100&Total=1500,500,100&Subtotal=2100&IVALine=21%25&IVAMonto=441&Total=2541&Nota=Pago%20a%20realizar%20en%20los%20próximos%2030%20días.&NotaP=Este%20es%20un%20documento%20informativo.
```