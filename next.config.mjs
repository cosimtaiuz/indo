/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'ssyeqtxpjbrkgqpgkkcq.supabase.co',
                port: '',
                pathname: '/storage/v1/**'
            }
        ]
    }
};

export default nextConfig;
