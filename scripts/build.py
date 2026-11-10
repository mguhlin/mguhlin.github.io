#!/usr/bin/env python3
"""Render the directory as static, progressively enhanced HTML. No dependencies."""
import json
from collections import Counter
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
projects = json.loads((ROOT / 'data/projects.json').read_text())
assert len({p.get('id', p['repo']) for p in projects}) == len(projects), 'Duplicate project ID'
assert len({p['url'] for p in projects}) == len(projects), 'Duplicate project URL'
for project in projects:
    assert project['url'].startswith('https://')
    assert (ROOT / 'assets/images' / project['image']).is_file(), project['image']
counts = Counter(p['category'] for p in projects)
h = escape
arrow = '<span aria-hidden="true">↗</span>'
code_icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/></svg>'
cards = []
for i, p in enumerate(projects):
    source_url = p.get('source_url', f"https://github.com/mguhlin/{p['repo']}")
    tags = ''.join(f'<span class="tag">{h(t)}</span>' for t in p['tags'])
    featured = '<span class="card-featured">Start here</span>' if p.get('featured') else ''
    note = f'<p class="card-note">{h(p["note"])}</p>' if p.get('note') else ''
    art_class = 'art-contain' if p['repo'] in ('drawsplat','gridsplat','Prospect47') else 'art-top' if p['repo'] in ('contraband','dev','creations','funquiz') else ''
    search = ' '.join([p['repo'],p['name'],p['category'],p['eyebrow'],p['description'],*p['tags']]).lower()
    cards.append(f'''<article class="project-card" data-category="{h(p['category'])}" data-name="{h(p['name'])}" data-order="{i}" data-search="{h(search)}">
      <div class="card-media"><img class="{art_class}" src="assets/images/{h(p['image'])}" width="720" height="400" alt="" loading="lazy" decoding="async">{featured}</div>
      <div class="card-body"><p class="eyebrow">{h(p['eyebrow'])}</p>
        <h3><a href="{h(p['url'])}">{h(p['name'])}</a></h3>
        <p class="card-description">{h(p['description'])}</p><div class="tags">{tags}</div>{note}
        <div class="card-footer"><a class="launch" href="{h(p['url'])}" aria-label="Open {h(p['name'])}">Explore project <span class="arrow">{arrow}</span></a><a class="source" href="{h(source_url)}" aria-label="{h(p['name'])} source on GitHub">{code_icon} Source</a></div>
      </div></article>''')
filters = ''.join(f'<button type="button" data-filter="{h(c)}" aria-pressed="{str(c == "All projects").lower()}">{h(c)} <span aria-hidden="true">{n}</span></button>' for c,n in [('All projects',len(projects)),*counts.items()])
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creations by Miguel Guhlin — Tools, Learning & Play</title>
<meta name="description" content="Explore Miguel Guhlin's active creations: DrawSplat, Contraband, learning resources, browser games, and practical tools. Find a project and make something your own.">
<meta name="theme-color" content="#26364a"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="https://mguhlin.github.io/">
<meta property="og:type" content="website"><meta property="og:title" content="Creations by Miguel Guhlin">
<meta property="og:description" content="Ideas made useful. Browser tools, learning resources, and a few worlds to explore.">
<meta property="og:url" content="https://mguhlin.github.io/"><meta property="og:image" content="https://mguhlin.github.io/assets/images/workspace.webp">
<meta property="og:image:alt" content="An AI-generated photograph of a sunlit creative workspace with a sketchbook, laptop, and coffee.">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/site.css">
<script src="assets/site.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap header-inner">
  <a class="brand" href="./" aria-label="Creations by Miguel Guhlin, home"><span class="brand-mark" aria-hidden="true">mg.</span><span><strong>Miguel Guhlin</strong><small>A collection of curiosities & creations</small></span></a>
  <nav class="site-nav" aria-label="Main navigation"><a href="#projects">Explore</a><a class="nav-about" href="#about">About</a><a class="nav-github" href="https://github.com/mguhlin">GitHub <span aria-hidden="true">↗</span></a><a class="nav-blog" href="https://mguhlin.org/">Read the blog <span class="arrow" aria-hidden="true">↗</span></a></nav>
</div></header>
<main id="main">
<section class="hero wrap" aria-labelledby="hero-title">
  <div class="hero-layout"><div class="hero-copy"><p class="eyebrow">The creative side of Another Think Coming</p>
    <h1 id="hero-title">Ideas made useful<br><span>Curiosity put to work</span></h1>
    <p class="hero-intro">Tools to make something. Resources to learn something. A few worlds to get lost in. Explore what I’m building at the intersection of education, technology, and play.</p>
    <div class="hero-actions"><a class="button" href="#projects">Explore the collection <span aria-hidden="true">↓</span></a><a class="text-link" href="https://mguhlin.org/about/">Meet Miguel <span class="arrow" aria-hidden="true">↗</span></a></div>
  </div><figure class="hero-art"><img src="assets/images/workspace.webp" width="1500" height="1000" fetchpriority="high" alt="AI-generated photograph of a sunlit desk with a sketchbook, navy notebook, laptop, and coffee."><figcaption>From “what if?” to something you can use</figcaption></figure></div>
  <div class="collection-meta"><div class="meta-left"><span><strong>{len(projects)} projects</strong> to explore</span><span>Tools, learning & play</span><span>By Miguel Guhlin</span></div></div>
</section>
<section id="projects" class="directory wrap" aria-labelledby="projects-title">
  <div class="section-heading"><div><h2 id="projects-title">Find your next discovery</h2><p>Pick a starting point. Follow your curiosity.</p></div><span id="result-count" class="directory-count" role="status" aria-live="polite">{len(projects)} of {len(projects)} projects</span></div>
  <div id="directory-controls" hidden><div class="search-row"><form id="project-search" class="search-form" role="search"><label class="sr-only" for="search">Search projects</label><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" id="search" name="q" placeholder="Search projects" autocomplete="off"></form><label class="sort-label" for="sort"><span>Sort by</span><select id="sort" aria-label="Sort by"><option value="featured">Featured first</option><option value="az">Name: A–Z</option></select></label></div><div class="filters" role="group" aria-label="Filter by category">{filters}</div></div>
  <noscript><p>All projects are listed below. Search and filters are available when JavaScript is enabled.</p></noscript>
  <div id="project-grid" class="project-grid">{''.join(cards)}</div>
  <div class="empty" id="empty-state" hidden><h3>No projects found</h3><p>Try a different word or explore the full collection.</p><button type="button" id="clear-filters" class="button">Clear search & filters</button></div>
</section>
<section id="about" class="about" aria-labelledby="about-title"><div class="wrap about-layout"><div><p class="eyebrow">A note from the maker</p><h2 id="about-title">Built to explore. Shared to be useful</h2><p>I’m Miguel Guhlin—an educator, writer, and maker. These projects grow out of questions about learning, creative work, and what we can build with a little curiosity and the help of AI.</p><p>This is the front door to my active GitHub Pages projects. For the writing behind the work, visit <a href="https://mguhlin.org/">Another Think Coming</a>.</p></div><aside class="elsewhere" aria-label="More to explore"><h3>Keep exploring</h3><a href="https://mguhlin.org/"><span>Another Think Coming<small>Writing on education, AI, privacy, and practical tools</small></span>{arrow}</a><a href="https://mglearn.github.io/"><span>mglearn<small>Classroom learning resources created for TCEA</small></span>{arrow}</a><a href="https://github.com/mguhlin"><span>On GitHub<small>Source code, project notes, and the wider repository list</small></span>{arrow}</a></aside></div></section>
</main>
<footer class="site-footer"><div class="wrap footer-inner"><div class="footer-note"><p><strong>© Miguel Guhlin · Made with curiosity.</strong></p><p>Each project has its own licensing and privacy details. This directory uses no analytics or tracking cookies. Illustrative imagery includes AI-generated photography and artwork from the projects.</p></div><div class="footer-links"><a href="https://github.com/mguhlin/mguhlin.github.io/blob/main/docs/inventory.md">About this index</a><a href="https://github.com/mguhlin/mguhlin.github.io/issues">Report a broken link</a><a href="#main">Back to top ↑</a></div></div></footer>
</body></html>
'''
(ROOT / 'index.html').write_text(html)
print(f'Built index.html with {len(projects)} projects.')
