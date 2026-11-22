import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";

const SENTENCE = "Noe gikk galt hos oss. Prøv igjen om litt.";

describe.each([
  ["error.tsx", ErrorPage],
  ["global-error.tsx", GlobalError],
])("%s", (_, Page) => {
  const html = renderToStaticMarkup(createElement(Page));

  it("UX-DR23: has one <h1> with the 500 sentence", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${SENTENCE}</h1>`);
  });

  it("UX-DR15: keeps the Host top bar and skip link", () => {
    for (const text of ["Hopp til innhold", "<header", ">Toppsvar</a>"])
      expect(html).toContain(text);
    expect(html).toContain('id="innhold"');
  });

  // A client component cannot read the httpOnly session cookie, so it never claims a session.
  it('UX-DR15: shows no "Mine spill" or "Logg ut"', () => {
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("Mine spill");
    expect(html).not.toContain("Logg ut");
  });
});

it('UX-DR23: global-error.tsx renders its own <html lang="nb">', () => {
  expect(renderToStaticMarkup(createElement(GlobalError))).toMatch(
    /^<html lang="nb">/,
  );
});
