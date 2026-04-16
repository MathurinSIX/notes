import argparse
import os
import shutil


def write_after(path: str, text: str, new_line: str):
    with open(path) as in_file:
        buf = in_file.readlines()

    with open(path, "w") as out_file:
        for line in buf:
            if line == text:
                line = line + f"{new_line}\n"
            out_file.write(line)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create a new table with standard API route."
    )
    parser.add_argument("--tablename", required=True, type=str)
    parser.add_argument("--classname", required=True, type=str)
    parser.add_argument("--classname_plural", required=True, type=str)
    parser.add_argument("--tagname", required=True, type=str)
    parser.add_argument("--docname", required=True, type=str)
    parser.add_argument("--docname_plural", required=True, type=str)
    parser.add_argument("--funcname", required=True, type=str)
    parser.add_argument("--funcname_plural", required=True, type=str)
    args = parser.parse_args()

    os.mkdir(f"backend/app/api/routes/{args.tablename}")
    for file in [
        "models.py",
        "repository.py",
        "schemas.py",
        "service.py",
        "routes.py",
    ]:
        shutil.copyfile(
            f"backend/app/api/routes/_template/{file}",
            f"backend/app/api/routes/{args.tablename}/{file}",
        )
        with open(f"backend/app/api/routes/{args.tablename}/{file}", "w") as f:
            f.write(
                open(
                    f"backend/app/api/routes/_template/{file}",
                )
                .read()
                .replace("{TABLENAME}", args.tablename)
                .replace("{CLASSNAME}", args.classname)
                .replace("{CLASSNAME_PLURAL}", args.classname_plural)
                .replace("{TAGNAME}", args.tagname)
                .replace("{DOCNAME}", args.docname)
                .replace("{DOCNAME_PLURAL}", args.docname_plural)
                .replace("{FUNCNAME}", args.funcname)
                .replace("{FUNCNAME_PLURAL}", args.funcname_plural)
            )

    # Add new route in router
    write_after(
        "backend/app/api/main.py",
        "# Import routes\n",
        f"from app.api.routes.{args.tablename} import routes as {args.tablename}_routes",
    )
    write_after(
        "backend/app/api/main.py",
        "# Add to router\n",
        f"api_router.include_router({args.tablename}_routes.router)",
    )

    # Add new route in alembic
    write_after(
        "backend/app/alembic/env.py",
        "# Models to be included in migrations\n",
        f"from app.api.routes.{args.tablename}.models import SQLModel as {args.classname}SQLModel # noqa",
    )
