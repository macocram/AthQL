# Changelog

All notable changes to AthQL are documented here. Version numbers follow [SemVer](https://semver.org/).

Format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-06-07

First stable release — local-first Athena query manager ready for daily use.

### Added

- Multi-tab SQL editor with Monaco, format SQL, and database picker
- Glue catalog explorer and query execution with polling + results grid
- Saved queries with folders, tags, search, and overwrite confirmation
- Query history and CSV download via pre-signed S3 URLs
- Settings UI for AWS profile, region, and workgroup (`config/athql.env`)
- Local SQLite metadata store (`~/.athql/metadata.db`)
- Structured AWS error handling and opt-in debug logging (`ATHQL_DEBUG=1`)
- GitHub Pages site and README documentation

[1.0.0]: https://github.com/Amit3200/AthQL/releases/tag/v1.0.0
