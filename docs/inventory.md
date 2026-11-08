# Directory inventory

This directory uses the GitHub public repositories API and live sites to identify published projects.

Inclusion: public, non-archived `mguhlin` repositories with GitHub Pages enabled,
excluding this directory itself. Also include standalone projects published
inside this site's `games/` folder, such as PBL Wordle. This means “active” is a repository/publication
status, not a claim that each project is frequently updated or production software.
There are 20 entries: 19 repository projects and one game hosted inside this
site. Each card links to its source repository or source folder.

- **DrawSplat:** launches the working canonical custom domain, drawsplat.org.
- **Creations:** the wider original collection at `/creations/`.
- **Contraband:** book learning rooms at `/contraband/`.
- **NSPA:** current combined AI and scholarship resource collection at `/nspa/`.
- **Postbox:** standalone offline email viewer and portable downloads at `/postbox/`.
- **GridSplat:** standalone spreadsheet at `/gridsplat/`.
- **Prospect 47:** sandbox game at `/Prospect47/` (preserve capitalization).
- **Dungeon Run:** game at `/dungeonrun/`.
- **Suffrage Sojourn:** the original `/sojourn/` now redirects to
  `https://mglearn.github.io/sojourn/`; the card launches the current destination.
- **Difficult Conversations:** coaching activity at `/ndc/`.
- **Coaching with UDL:** `/cudl/` redirects to `/creations/cudl/`; linked directly.
- **Emotional Intelligence:** self-assessment at `/eisa26/`.
- **Character Quizzes:** quiz collection entry point at `/funquiz/`.
- **ACE It:** assignment builder and ACE Check at `/ace/`.
- **History Learning Center:** history inquiry collections at `/hlc/`.
- **Science Learning Center:** science activities at `/slc/`.
- **Sapiqo LMS:** self-hosted LMS introduction and downloads at `/sapiqolms/`.
- **SplatLMS:** SplatWorks LMS introduction and downloads at `/splatlms/`.
- **Web Decks:** presentation framework, specification, and starter at `/webdecks/`.
- **PBL Wordle:** classroom vocabulary game at `/games/pblwordle/`.

Website Design Study (`/dev/`) is excluded from this directory at the owner's
request. Its site and repository remain available.

Excluded archived repositories: `nspaaifluency`, `nspa3`, `vlet`, `aici`, `acl`,
`architect`, `eog`. The current blog is linked separately at mguhlin.org.
The nested resources within Creations remain available
through its own directory, rather than being duplicated as top-level repositories.

`data/repositories-snapshot.json` preserves the repository metadata used for this
review. Run `scripts/check-inventory.py` before future updates, verify moved
locations, then review and edit `data/projects.json`.
