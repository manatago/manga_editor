import { protocol, net } from 'electron'
import * as fs from 'fs'
import { pathToFileURL } from 'url'

export const LOCAL_FILE_PROTOCOL_SCHEMES = [
    {
        scheme: 'local-file',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            bypassCSP: false,
            stream: true
        }
    }
]

export function registerLocalFileProtocol(): void {
    protocol.handle('local-file', (request) => {
        try {
            // Electron's protocol.handle gives a full URL.
            // For custom standard protocols, local-file:///Users/... might have /Users as pathname or Users as host.
            // To be robust, we combine host and pathname if host exists.
            const url = new URL(request.url)
            let rawPath = url.host ? (url.host + url.pathname) : url.pathname

            // On Mac/Linux, if rawPath doesn't start with /, it should probably have one.
            if (!rawPath.startsWith('/') && !/^[a-zA-Z]:/.test(rawPath)) {
                rawPath = '/' + rawPath
            }

            const decodedPath = decodeURIComponent(rawPath)

            if (!fs.existsSync(decodedPath)) {
                console.error('Main: local-file protocol - File NOT FOUND at:', decodedPath)
            }

            return net.fetch(pathToFileURL(decodedPath).toString())
        } catch (error) {
            console.error('Main: local-file protocol fatal error:', error)
            throw error
        }
    })
}
