import asyncio
from api.utils.db import get_new_db_connection

async def insert_user():
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            """INSERT INTO users (id, email, first_name, last_name) 
               VALUES (2, 'user2@example.com', 'Admin', 'User')"""
        )
        await conn.commit()

if __name__ == "__main__":
    asyncio.run(insert_user())
