"""Build the Safari AR models with Python, usd-core and Node.js."""

import json
import math
import struct
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def load_vessel_definitions():
    result = subprocess.run(
        [
            "node", "--input-type=module", "-e",
            "import * as vessels from './dist/vessels.js';"
            "console.log(JSON.stringify(vessels));",
        ],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def lathe(profile, segments=72):
    points, normals, indices = [], [], []
    rings = len(profile)
    for segment in range(segments):
        angle = math.tau * segment / segments
        x, z = math.sin(angle), math.cos(angle)
        for ring, (radius, height) in enumerate(profile):
            start = profile[max(0, ring - 1)]
            end = profile[min(rings - 1, ring + 1)]
            dy, dr = end[1] - start[1], end[0] - start[0]
            length = math.hypot(dy, dr)
            points.append((x * radius, height, z * radius))
            normals.append((x * dy / length, -dr / length, z * dy / length))
            if ring == rings - 1:
                continue
            a, b = segment * rings + ring, ((segment + 1) % segments) * rings + ring
            if radius:
                indices.extend((a, b, a + 1))
            if profile[ring + 1][0]:
                indices.extend((b, b + 1, a + 1))
    return points, normals, indices


def load_glass(asset):
    data = (DIST / asset["url"]).read_bytes()
    json_length, = struct.unpack_from("<I", data, 12)
    gltf = json.loads(data[20:20 + json_length])
    binary = memoryview(data)[28 + json_length:]
    primitive = gltf["meshes"][0]["primitives"][0]

    def read_accessor(index):
        accessor = gltf["accessors"][index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        formats = {(5126, "VEC3"): "<3f", (5123, "SCALAR"): "<H", (5125, "SCALAR"): "<I"}
        parser = struct.Struct(formats[accessor["componentType"], accessor["type"]])
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", parser.size)
        return [parser.unpack_from(binary, offset + i * stride) for i in range(accessor["count"])]

    factor = 2.398 / asset["height"]
    positions = read_accessor(primitive["attributes"]["POSITION"])
    points = [(x * factor, y * factor, (z - asset.get("z", 0)) * factor) for x, y, z in positions]
    normals = read_accessor(primitive["attributes"]["NORMAL"])
    indices = [index for (index,) in read_accessor(primitive["indices"])]
    return points, normals, indices


def material(stage, name, color, opacity, roughness):
    path = f"/Flask/{name}"
    result = UsdShade.Material.Define(stage, path)
    shader = UsdShade.Shader.Define(stage, f"{path}/Surface")
    shader.CreateIdAttr("UsdPreviewSurface")
    shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color))
    shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(roughness)
    shader.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(opacity)
    shader.CreateInput("ior", Sdf.ValueTypeNames.Float).Set(1.45)
    result.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    return result


def add_mesh(stage, name, geometry, surface, ground, scale):
    points, normals, indices = geometry
    points = [Gf.Vec3f(x * scale, (y - ground) * scale, z * scale) for x, y, z in points]
    mesh = UsdGeom.Mesh.Define(stage, f"/Flask/{name}")
    mesh.CreatePointsAttr(points)
    mesh.CreateExtentAttr(UsdGeom.PointBased.ComputeExtent(points))
    mesh.CreateNormalsAttr([Gf.Vec3f(*normal) for normal in normals])
    mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
    mesh.CreateFaceVertexCountsAttr([3] * (len(indices) // 3))
    mesh.CreateFaceVertexIndicesAttr(indices)
    mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
    UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(surface)


def build():
    data = load_vessel_definitions()
    profile = data["primaryProfile"]
    for name, fill in data["fills"].items():
        asset = data["assets"].get(name)
        glass = load_glass(asset) if asset else lathe([(0, profile[0][1]), *profile])
        liquid = lathe([*fill["profile"], (0, fill["top"])])
        ground = min(y for _, y, _ in glass[0])
        model_offset = asset.get("minY", 0) * 2.398 / asset["height"] if asset else 0
        fill_offset = ground - model_offset

        with TemporaryDirectory() as scratch:
            source = Path(scratch) / "flask.usdc"
            stage = Usd.Stage.CreateNew(str(source))
            UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
            UsdGeom.SetStageMetersPerUnit(stage, 1)
            stage.SetDefaultPrim(UsdGeom.Xform.Define(stage, "/Flask").GetPrim())
            glass_surface = material(stage, "Glass", (.52, .62, .81), .30, .14)
            liquid_surface = material(stage, "Solution", (.23, .26, .66), .82, .24)
            add_mesh(stage, "Vessel", glass, glass_surface, ground, data["vesselScale"])
            add_mesh(stage, "Liquid", liquid, liquid_surface, fill_offset, data["vesselScale"])
            stage.GetRootLayer().Save()
            target = DIST / "assets" / f"{name}.usdz"
            if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(str(source)), str(target)):
                raise RuntimeError(f"Could not package {target}")


if __name__ == "__main__":
    build()
