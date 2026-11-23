import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import SpillError from "@/app/spill/error";
import SvarError from "@/app/svar/error";

const SENTENCE = "Noe gikk galt hos oss. Prøv igjen om litt.";
const render = (Page: typeof ErrorPage) =>
  renderToStaticMarkup(createElement(Page, { retry: () => {} }));

describe.each([
  ["error.tsx", ErrorPage],
  ["global-error.tsx", GlobalError],
  ["spill/error.tsx", SpillError],
  ["svar/error.tsx", SvarError],
])("%s", (_, Page) => {
  const html = render(Page);

  it("UX-DR23: has one <h1> with the 500 sentence, its <title> and a Prøv igjen button", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${SENTENCE}</h1>`);
    expect(html).toContain("<title>Noe gikk galt – Toppsvar</title>");
    expect(html).toMatch(
      /<button type="button"[^>]*>.*Prøv igjen.*<\/button>/s,
    );
  });
});

describe.each([
  ["error.tsx", ErrorPage],
  ["global-error.tsx", GlobalError],
])("%s", (_, Page) => {
  const html = render(Page);

  it("UX-DR15: keeps the Host top bar and skip link", () => {
    for (const text of ["Hopp til innhold", "<header", 'href="/">Toppsvar</a>'])
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

// The spill layout around it supplies the signed-in top bar.
it("UX-DR15: spill/error.tsx renders no chrome of its own", () => {
  expect(render(SpillError)).not.toContain("<header");
});

it('UX-DR23: global-error.tsx renders its own <html lang="nb">', () => {
  expect(render(GlobalError)).toMatch(/^<html lang="nb">/);
});

it("FR-1, UX-DR27: svar/error.tsx shows only the wordmark: no link, nav or skip link", () => {
  const html = render(SvarError);
  expect(html).toContain(">Toppsvar</p>");
  for (const text of ["<a ", "<nav", "Hopp til innhold", "Logg ut"])
    expect(html).not.toContain(text);
});
