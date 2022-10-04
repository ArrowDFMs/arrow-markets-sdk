import arrowsdk from "../src/arrow-sdk"
import { Version } from "../src/types"

describe('Utility function tests', () => {
    test('Expects to return the router contract', async () => {
        const v4Router = await arrowsdk.getRouterContract(Version.V4)
        const v3Router = await arrowsdk.getRouterContract(Version.V3)
        const contestRouter = await arrowsdk.getRouterContract(Version.COMPETITION)

        expect(v4Router.address).toBe('0x0004C98F75A4e6824EC1B4eB285ff18D0b7257C4')
        expect(v3Router.address).toBe('0x31122CeF9891Ef661C99352266FA0FF0079a0e06')
        expect(contestRouter.address).toBe('0xD0890Cc0B2F5Cd6DB202378C35F39Db3EB0A4b0C')
    })

    test('Expects to return the stablecoin contract', async () => {
        const v4Stablecoin = await arrowsdk.getStablecoinContract(Version.V4)
        const v3Stablecoin = await arrowsdk.getStablecoinContract(Version.V3)
        const contestStablecoin = await arrowsdk.getStablecoinContract(Version.COMPETITION)

        expect(v4Stablecoin.address).toBe('0x7CE8C01897a055665B78315894b82DeE3C86823f')
        expect(v3Stablecoin.address).toBe('0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9')
        expect(contestStablecoin.address).toBe('0x2bFCf0aa3776Bb285860Ae595C7BE5C6Fea4Ca8e')
    })

    test('Expects to return the events contract', async () => {
        const v4EventsContract = await arrowsdk.getStablecoinContract(Version.V4)
        const v3EventsContract = await arrowsdk.getEventsContract(Version.V3)
        const contestEventsContract = await arrowsdk.getEventsContract(Version.COMPETITION)

        expect(v4EventsContract.address).toBe('0x7CE8C01897a055665B78315894b82DeE3C86823f')
        expect(v3EventsContract.address).toBe('0x932BC618C972Ef2703cD66A751747d71e7A1BB3D')
        expect(contestEventsContract.address).toBe('0x6E43C4568B8a82a083F45ee7e78b89775C16FEd8')
    })

    test('Expects to return the registry contract', async () => {
        const v4RegistryContract = await arrowsdk.getRegistryContract(Version.V4)
        const v3RegistryContract = await arrowsdk.getRegistryContract(Version.V3)
        const contestRegistryContract = await arrowsdk.getRegistryContract(Version.COMPETITION)

        expect(v4RegistryContract.address).toBe('0xD11dBc6022A9E299b6FBCC17706fc89753CCafa1')
        expect(v3RegistryContract.address).toBe('0xe72175c1b3A9A287302276491bfb9ad275842876')
        expect(contestRegistryContract.address).toBe('0xA8C72D5a00C020DF52A3Dbc22CcA0a918fc9594f')
    })

})