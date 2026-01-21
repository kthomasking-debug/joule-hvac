import asyncio
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser, AsyncListener
from aiohomekit.controller import Controller
from aiohomekit.zeroconf import HAP_TYPE_TCP

class HomeKitServiceListener(AsyncListener):
    """Dummy listener for HomeKit services"""
    async def async_add_service(self, zc, service_type, name):
        print(f"Service added: {name}")
    async def async_remove_service(self, zc, service_type, name):
        print(f"Service removed: {name}")
    async def async_update_service(self, zc, service_type, name):
        print(f"Service updated: {name}")

async def test():
    print("Testing AsyncZeroconf with AsyncServiceBrowser...")
    try:
        zc = AsyncZeroconf()
        print(f"Created AsyncZeroconf: {zc}")
        print(f"Has zeroconf: {zc.zeroconf}")
        
        print("\nCreating AsyncServiceBrowser for _hap._tcp.local...")
        listener = HomeKitServiceListener()
        browser = AsyncServiceBrowser(zc.zeroconf, HAP_TYPE_TCP, listener=listener)
        print(f"Browser created: {browser}")
        print(f"Browser types: {browser.types}")
        
        # Wait a moment for browser to register
        await asyncio.sleep(0.5)
        
        print("\nTesting Controller with AsyncZeroconf...")
        controller = Controller(async_zeroconf_instance=zc)
        print(f"Controller created: {controller}")
        
        print("\nTesting async_start...")
        await controller.async_start()
        print("✅ async_start succeeded!")
        
        await controller.async_stop()
        browser.cancel()
        await zc.async_close()
        print("✅ Cleanup successful!")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test())

