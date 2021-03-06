from gino.ext.starlette import Gino
from aiocache import caches, RedisCache, serializers

from .. import config

db = Gino(
    dsn=config.DB_DSN,
    pool_min_size=config.DB_POOL_MIN_SIZE,
    pool_max_size=config.DB_POOL_MAX_SIZE,
    echo=config.DB_ECHO,
    ssl=config.DB_SSL,
    use_connection_for_request=config.DB_USE_CONNECTION_FOR_REQUEST,
    retry_limit=config.DB_RETRY_LIMIT,
    retry_interval=config.DB_RETRY_INTERVAL,
)

caches.set_config({
    'default': {
        'cache': RedisCache,
        'endpoint': config.CACHE_ENDPOINT,
        'port': 6379,
        'timeout': None,
        'pool_min_size': 5,
        'pool_max_size': 20,
        'serializer': {
            'class': serializers.PickleSerializer
        }
    }
})

cache = caches.get('default')   # This always returns the same instance


# cache = RedisCache(
#     endpoint=config.CACHE_ENDPOINT,
#     serializer=serializers.PickleSerializer(),
#     timeout=10,
#     pool_min_size=5,
#     pool_max_size=20
# )
