"""Python client for HUSH (https://hushagents.com). Standard library only."""
from .client import HushClient, HushError

__all__ = ["HushClient", "HushError"]
__version__ = "0.1.0"
