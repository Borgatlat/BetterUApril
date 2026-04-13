@echo off
echo Checking for widget extension folder...
echo.

if exist "ios\BetterUWidget" (
    echo ✅ Folder EXISTS: ios\BetterUWidget
    echo You can skip the Mac step!
    dir ios\BetterUWidget
) else (
    echo ❌ Folder DOES NOT EXIST: ios\BetterUWidget
    echo You'll need Mac access to create it (one-time, 30 min)
)

echo.
pause

