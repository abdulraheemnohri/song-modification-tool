@ECHO OFF

pushd %~dp0

REM Command file for Sphinx documentation

if "%SPHINXBUILD%" == "" (
    set SPHINXBUILD=sphinx-build
)

if "%1" == "" goto help
if "%1" == "help" goto help

%SPHINXBUILD% >NUL 2>NUL
if errorlevel 9009 (
    echo.
    echo.The 'sphinx-build' command was not found.
    echo.
    goto end
)

%SPHINXBUILD% -M %1 . _build %SPHINXOPTS% %O%
goto end

:help
%SPHINXBUILD% -M help . _build %SPHINXOPTS% %O%

:end
popd
