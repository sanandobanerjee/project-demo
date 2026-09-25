from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url:str="sqlite:///./app/db"
    app_name:str="Tech Debt Analyzer"

    class Config:
        env_file=".env"

settings=Settings()