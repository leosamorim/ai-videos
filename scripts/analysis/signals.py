"""Local measurements only. No take selection, network, ASR or media mutation."""
import importlib.metadata
import json
import math
import sys
import time
import wave
from contextlib import ExitStack


def versions():
    return {"python": sys.version.split()[0], "packages": dict(sorted(
        (d.metadata["Name"].lower(), d.version) for d in importlib.metadata.distributions()
    ))}


def audio(request):
    import numpy as np
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(request["models"]["audio"], options,
                                   providers=["CPUExecutionProvider"])
    state = np.zeros((2, 1, 128), dtype=np.float32)
    context = np.zeros((1, 64), dtype=np.float32)
    rows = []
    with wave.open(request["input"], "rb") as pcm:
        if (pcm.getframerate(), pcm.getnchannels(), pcm.getsampwidth()) != (16000, 1, 2):
            raise ValueError("expected PCM16 mono 16 kHz on the source-video clock")
        samples = pcm.getnframes()
        for offset in range(0, samples, 512):
            chunk = np.frombuffer(pcm.readframes(512), dtype="<i2").astype(np.float32) / 32768
            chunk = np.pad(chunk, (0, 512 - len(chunk))).reshape(1, 512)
            data = np.concatenate([context, chunk], axis=1)
            probability, state = session.run(None, {
                "input": data, "state": state, "sr": np.array(16000, dtype=np.int64)
            })
            rows.append([round(offset / 16000, 6), round(float(probability[0, 0]), 6)])
            context = data[:, -64:]
    return {"sample_rate": 16000, "samples": samples, "step": 0.032,
            "columns": ["time", "speech_probability"], "rows": rows}


def visual(request):
    import cv2
    import mediapipe as mp
    import numpy as np

    tasks = mp.tasks.vision
    base = mp.tasks.BaseOptions
    rows = []
    capture = cv2.VideoCapture(request["input"])
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not capture.isOpened() or abs(fps - 30) > 0.01:
            raise ValueError("expected the verified 30 fps analyze proxy")
        for window in request["windows"]:
            # Each discontinuous interval gets fresh tracking state; never infer across gaps.
            with ExitStack() as stack:
                face = stack.enter_context(tasks.FaceLandmarker.create_from_options(tasks.FaceLandmarkerOptions(
                    base_options=base(model_asset_path=request["models"]["face"], delegate=base.Delegate.CPU),
                    running_mode=tasks.RunningMode.VIDEO, num_faces=1,
                    output_facial_transformation_matrixes=True)))
                pose = None
                if request.get("pose"):
                    pose = stack.enter_context(tasks.PoseLandmarker.create_from_options(tasks.PoseLandmarkerOptions(
                        base_options=base(model_asset_path=request["models"]["pose"], delegate=base.Delegate.CPU),
                        running_mode=tasks.RunningMode.VIDEO, num_poses=1)))
                first = math.ceil(window["start"] * fps - 1e-6)
                stop = math.ceil(window["end"] * fps - 1e-6)
                stride = int(round(fps / request["fps"]))
                if not capture.set(cv2.CAP_PROP_POS_FRAMES, first):
                    raise ValueError(f"cannot seek proxy to frame {first}")
                for index in range(first, stop):
                    ok = capture.grab()
                    if not ok:
                        raise ValueError(f"proxy ended early at frame {index}")
                    if abs(capture.get(cv2.CAP_PROP_POS_FRAMES) - (index + 1)) > 0.01:
                        raise ValueError(f"proxy frame clock diverged at {index}")
                    if (index - first) % stride:
                        continue
                    ok, frame = capture.retrieve()
                    if not ok:
                        raise ValueError(f"cannot decode frame {index}")
                    rgb = mp.Image(image_format=mp.ImageFormat.SRGB,
                                   data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    timestamp = round(index / fps * 1000)
                    result = face.detect_for_video(rgb, timestamp)
                    row = {"time": round(index / fps, 6), "face": bool(result.face_landmarks)}
                    if result.face_landmarks:
                        landmarks = result.face_landmarks[0]
                        row["box"] = [round(v, 5) for v in (
                            min(p.x for p in landmarks), min(p.y for p in landmarks),
                            max(p.x for p in landmarks), max(p.y for p in landmarks))]
                        matrix = np.asarray(result.facial_transformation_matrixes[0])[:3, :3]
                        matrix = matrix / np.maximum(np.linalg.norm(matrix, axis=0), 1e-9)
                        row["orientation_degrees"] = [round(float(v), 3) for v in cv2.RQDecomp3x3(matrix)[0]]
                    if pose is not None:
                        body = pose.detect_for_video(rgb, timestamp)
                        row["pose"] = bool(body.pose_landmarks)
                        if body.pose_landmarks:
                            row["wrists"] = [[round(float(getattr(body.pose_landmarks[0][i], key)), 5)
                                              for key in ("x", "y", "visibility")] for i in (15, 16)]
                    rows.append(row)
    finally:
        capture.release()
    return {"fps": request["fps"], "windows": request["windows"], "rows": rows,
            "limitations": "Single subject; orientation is uncalibrated head geometry, not gaze, emotion or intent."}


def main():
    if sys.argv[1:] == ["--versions"]:
        print(json.dumps(versions()))
        return
    with open(sys.argv[1], encoding="utf8") as stream:
        request = json.load(stream)
    start = time.monotonic()
    result = audio(request) if request["kind"] == "audio" else visual(request)
    result.update(schema=1, clock="source-video", kind=request["kind"],
                  seconds=round(time.monotonic() - start, 4))
    with open(sys.argv[2], "w", encoding="utf8") as stream:
        json.dump(result, stream, separators=(",", ":"), allow_nan=False)


if __name__ == "__main__":
    main()
