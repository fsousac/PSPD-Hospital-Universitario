$repoRoot = git rev-parse --show-toplevel
$protoRoot = "$repoRoot/proto"
$outDir = "src/generated"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (-not (Test-Path "$outDir/__init__.py")) { New-Item "$outDir/__init__.py" | Out-Null }

python -m grpc_tools.protoc `
    -I $protoRoot `
    --python_out=$outDir `
    --grpc_python_out=$outDir `
    "$protoRoot/patient_data.proto"

Write-Host "Stubs gerados em $outDir"
