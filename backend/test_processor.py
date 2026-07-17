import asyncio
import sys
import os
from app.processor import AudioProcessor

async def test():
    # Set loop policy for Windows if needed
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
    task_id = "test-task-123"
    proc = AudioProcessor(task_id)
    url = "https://www.youtube.com/watch?v=Tb3x5I0ulCg"
    print(f"Starting test for url: {url}")
    result = await proc.process_youtube(url)
    print("Result:", result)

if __name__ == "__main__":
    asyncio.run(test())
