from fastapi import APIRouter

from app.api.routes.login import routes as login_routes
from app.api.routes import utils
from app.api.routes.run import routes as run_routes
from app.api.routes.user import routes as user_routes
from app.api.routes.workflow import routes as workflow_routes

api_router = APIRouter()

api_router.include_router(login_routes.router)
api_router.include_router(user_routes.router)
api_router.include_router(run_routes.router)
api_router.include_router(workflow_routes.router)
api_router.include_router(utils.router)
