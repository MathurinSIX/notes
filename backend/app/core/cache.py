from cachetools import TTLCache

# In Memory Cache
ttl_cache = TTLCache(maxsize=1, ttl=300) # 1 list and 5 min expiry