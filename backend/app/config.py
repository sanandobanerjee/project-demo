from pydantic import ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    database_url:str="sqlite:///./app.db"
    app_name:str="Tech Debt Analyzer"

settings=Settings()