from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="realtime-streaming-service", version="0.1.0")


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active = [connection for connection in self.active if connection is not websocket]

    async def broadcast(self, message: dict) -> None:
        stale: list[WebSocket] = []
        for connection in self.active:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


manager = ConnectionManager()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/predictions")
async def prediction_stream(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(5)
            await manager.broadcast(
                {
                    "type": "prediction.update",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "payload": {
                        "game_id": "sample-game",
                        "league": "nba",
                        "win_probability_home": 0.61,
                        "confidence": 0.73,
                    },
                }
            )
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        manager.disconnect(websocket)
        await websocket.close(code=1011, reason=json.dumps({"error": str(exc)}))
