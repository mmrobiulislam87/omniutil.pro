export type OutputFormat = "svg" | "react" | "tailwind";

export type SvgTransformResult = {
  optimizedSvg: string;
  reactCode: string;
  tailwindCode: string;
  originalBytes: number;
  optimizedBytes: number;
  savingsPercent: number;
};

const JSX_ATTR_MAP: Record<string, string> = {
  class: "className",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "clip-path": "clipPath",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "text-anchor": "textAnchor",
  "xlink:href": "xlinkHref",
  "xml:space": "xmlSpace",
};

function toJsxAttr(name: string): string {
  if (JSX_ATTR_MAP[name]) return JSX_ATTR_MAP[name];
  if (name.includes("-")) {
    return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  return name;
}

function escapeJsxText(text: string): string {
  return text.replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function attrsToJsx(
  element: Element,
  options: { tailwind: boolean; isRoot?: boolean },
): string {
  const parts: string[] = [];
  let hasClass = false;

  for (const attr of Array.from(element.attributes)) {
    if (attr.name === "xmlns:xlink") continue;
    const jsxName = toJsxAttr(attr.name);
    let value = attr.value;

    if (options.tailwind && jsxName === "fill" && /^#(000000|000|black)$/i.test(value)) {
      value = "currentColor";
    }
    if (options.tailwind && jsxName === "stroke" && /^#(000000|000|black)$/i.test(value)) {
      value = "currentColor";
    }
    if (jsxName === "className") hasClass = true;

    parts.push(`${jsxName}="${value.replace(/"/g, '\\"')}"`);
  }

  if (options.isRoot) {
    parts.push("{...props}");
  }

  if (options.tailwind && options.isRoot) {
    if (hasClass) {
      // keep existing className from attrs
    } else {
      parts.push('className="h-6 w-6"');
    }
  }

  return parts.length ? " " + parts.join(" ") : "";
}

function elementToJsx(
  element: Element,
  indent: number,
  options: { tailwind: boolean; isRoot?: boolean },
): string {
  const pad = "  ".repeat(indent);
  const tag = element.tagName.toLowerCase();
  const isRoot = options.isRoot ?? false;
  const attrs = attrsToJsx(element, { tailwind: options.tailwind, isRoot });

  const childElements = Array.from(element.children);
  const textNodes = Array.from(element.childNodes).filter(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
  );

  if (childElements.length === 0 && textNodes.length === 0) {
    return `${pad}<${tag}${attrs} />`;
  }

  const lines: string[] = [`${pad}<${tag}${attrs}>`];

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) lines.push(`${pad}  ${escapeJsxText(text)}`);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      lines.push(
        elementToJsx(child as Element, indent + 1, {
          tailwind: options.tailwind,
        }),
      );
    }
  }

  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

function svgToReactComponent(svg: string, componentName: string, tailwind: boolean): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG markup.");
  }

  const svgEl = doc.querySelector("svg");
  if (!svgEl) {
    throw new Error("Invalid SVG: no <svg> root element found.");
  }

  const body = elementToJsx(svgEl, 2, { tailwind, isRoot: true });

  return `import type { SVGProps } from "react";

export function ${componentName}(props: SVGProps<SVGSVGElement>) {
  return (
${body}
  );
}
`;
}

function sanitizeComponentName(filename: string): string {
  const base = filename.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9]+/g, " ");
  const words = base
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const name = words.join("") || "GeneratedIcon";
  return /^[A-Z]/.test(name) ? name : `Icon${name}`;
}

export async function transformSvg(
  rawSvg: string,
  filename = "icon.svg",
): Promise<SvgTransformResult> {
  const trimmed = rawSvg.trim();
  if (!trimmed.includes("<svg")) {
    throw new Error("Paste or upload a valid SVG file.");
  }

  const { optimize } = await import("svgo/browser");
  const result = optimize(trimmed, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false,
            cleanupIds: false,
          },
        },
      },
    ],
  });

  if ("error" in result && result.error) {
    throw new Error(
      typeof result.error === "string" ? result.error : "SVGO optimization failed.",
    );
  }

  const optimizedSvg = result.data;
  const componentName = sanitizeComponentName(filename);
  const reactCode = svgToReactComponent(optimizedSvg, componentName, false);
  const tailwindCode = svgToReactComponent(optimizedSvg, componentName, true);

  const originalBytes = new TextEncoder().encode(trimmed).length;
  const optimizedBytes = new TextEncoder().encode(optimizedSvg).length;
  const savingsPercent =
    originalBytes > 0
      ? Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100)
      : 0;

  return {
    optimizedSvg,
    reactCode,
    tailwindCode,
    originalBytes,
    optimizedBytes,
    savingsPercent,
  };
}
