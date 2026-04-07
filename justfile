
up-version bump:
    #!/usr/bin/env bash
    set -euo pipefail
    npm version {{bump}} --no-git-tag-version
    version=$(node -p "require('./package.json').version")
    npm install --package-lock-only
    git add package.json package-lock.json
    git commit -m "Upped version to ${version}"
    git tag "${version}"
    git push
    git push origin "${version}"
