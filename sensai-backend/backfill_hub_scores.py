import asyncio
import sys
import os
from dotenv import load_dotenv

# Add src to path
sys.path.append(os.path.join(os.getcwd(), "src"))

# Load environment variables
load_dotenv(os.path.join(os.getcwd(), "src", "api", ".env"))

from api.db.hub import get_new_db_connection, hub_comments_table_name, hub_posts_table_name
from api.utils.hub_ai import score_hub_comment

async def backfill_scores():
    print("Starting backfill of hub comment confidence scores...")
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        
        # Get all comments
        await cursor.execute(
            f"""
            SELECT c.id, c.body, p.title, p.body
            FROM {hub_comments_table_name} c
            JOIN {hub_posts_table_name} p ON c.post_id = p.id
            """
        )
        comments = await cursor.fetchall()
        
        if not comments:
            print("No comments found without a confidence score.")
            return

        print(f"Found {len(comments)} comments to score.")
        
        for cid, cbody, ptitle, pbody in comments:
            print(f"Scoring comment {cid}...")
            try:
                score = await score_hub_comment(ptitle, pbody, cbody)
                await cursor.execute(
                    f"UPDATE {hub_comments_table_name} SET confidence_score = ? WHERE id = ?",
                    (score, cid)
                )
                print(f"  Result: {score}/10")
            except Exception as e:
                print(f"  Error scoring comment {cid}: {e}")
        
        await conn.commit()
    print("Backfill complete.")

if __name__ == "__main__":
    asyncio.run(backfill_scores())
