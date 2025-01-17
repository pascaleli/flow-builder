#!/bin/bash

# This apply needed changes before running yarn build,
# as described in https://github.com/FLOIP/flow-builder/blob/master/gh-pages-deploy.md

echo "Prepare gh-pages deployment"
# We're applying patches to temporary edit few file during the deployment

abort()
{
    echo >&2 '
******************************************************************************************
*** Patching aborted, there could be a conflict, you may need to re-generate patches manually
*** - Edit manually affected files (get inspiration from the affected *.patch files), then
*** - Regenerate patches, eg per patch type:
***     $ git diff src/router/index.ts > patches/gh-pages-prepare-router.patch
***     $ git diff vue.config.js > patches/gh-pages-prepare-vue-config.patch
***     $ git diff builder.config.json > patches/remove-backend-routes-from-config.patch
***     $ git diff builder.config.json > patches/disable-save-button.patch
*** - commit changes on the *patch file to fix this script
*** - re-run this script `./scripts/prepare-gh-pages-deployment.sh` to make sure every works. Redo above steps in case of error.
*** - rollback changes on the affected non patch files (eg: src/router/index.ts, vue.config.js, builder.config.json)
*****************************************************************************************
'
    echo "An error occurred. Exiting..." >&2
    exit 1
}

trap 'abort' 0

set -e # abort on errors

#----------------------------------------------------------
# If an error occurs, the abort() function will be called.
#----------------------------------------------------------
git apply -v patches/gh-pages-prepare-router.patch
git apply -v patches/gh-pages-prepare-vue-config.patch
git apply -v patches/remove-backend-routes-from-config.patch
git apply -v patches/disable-save-button.patch

# End of custom script!
trap : 0

echo >&2 '
************************
*** Patches applied ****
************************
'
