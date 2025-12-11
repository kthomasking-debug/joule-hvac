import asyncio
from zeroconf.asyncio import AsyncZeroconf
from aiohomekit.controller import Controller

async def test():
    print("Testing AsyncZeroconf...")
    try:
        zc = AsyncZeroconf()
        print(f"Created AsyncZeroconf: {zc}")
        print(f"Has zeroconf attr: {hasattr(zc, 'zeroconf')}")
        if hasattr(zc, 'zeroconf'):
            print(f"zeroconf value: {zc.zeroconf}")
        
        print("\nTesting Controller with AsyncZeroconf...")
        controller = Controller(async_zeroconf_instance=zc)
        print(f"Controller created: {controller}")
        print(f"Controller._async_zeroconf_instance: {controller._async_zeroconf_instance}")
        
        print("\nTesting async_start...")
        await controller.async_start()
        print("✅ async_start succeeded!")
        
        await controller.async_stop()
        await zc.async_close()
        print("✅ Cleanup successful!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test())

