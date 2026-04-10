import asyncio
from api.db.hub import get_posts_by_course

async def main():
    try:
        posts = await get_posts_by_course(course_id=2, sort="newest")
        print(posts)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
