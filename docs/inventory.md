# Directory inventory

Reviewed September 29, 2026 using the GitHub public repositories API and live sites.

Inclusion: public, non-archived `mguhlin` repositories with GitHub Pages enabled,
excluding this directory itself. This means “active” is a repository/publication
status, not a claim that each project is frequently updated or production software.
There are 13 entries. Each card identifies its source repository.

- **DrawSplat:** launches the working canonical custom domain, drawsplat.org.
- **Creations:** the wider original collection at `/creations/`.
- **Contraband:** book learning rooms at `/contraband/`.
- **NSPA:** current combined AI and scholarship resource collection at `/nspa/`.
- **GridSplat:** standalone spreadsheet at `/gridsplat/`.
- **Prospect 47:** sandbox game at `/Prospect47/` (preserve capitalization).
- **Dungeon Run:** game at `/dungeonrun/`.
- **Suffrage Sojourn:** the original `/sojourn/` now redirects to
  `https://mglearn.github.io/sojourn/`; the card launches the current destination.
- **Difficult Conversations:** coaching activity at `/ndc/`.
- **Coaching with UDL:** `/cudl/` redirects to `/creations/cudl/`; linked directly.
- **Emotional Intelligence:** self-assessment at `/eisa26/`.
- **Character Quizzes:** quiz collection entry point at `/funquiz/`.
- **Website Design Study:** `/dev/`, explicitly labeled an unofficial prototype.

Excluded archived repositories: `nspaaifluency`, `nspa3`, `vlet`, `aici`, `acl`,
`architect`, `eog`. `mgblog` has no GitHub Pages site; the current blog is linked
separately at mguhlin.org. The nested resources within Creations remain available
through its own directory, rather than being duplicated as top-level repositories.

`data/repositories-snapshot.json` preserves the repository metadata used for this
review. Run `scripts/check-inventory.py` before future updates, verify moved
locations, then review and edit `data/projects.json` and the visible checked date.
