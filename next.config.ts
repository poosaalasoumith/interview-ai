import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/candidate/submissions",
        destination: "/dashboard/candidate/submissions",
        permanent: true,
      },
      {
        source: "/candidate/submission-history",
        destination: "/dashboard/candidate/submissions",
        permanent: true,
      },
      {
        source: "/dashboard/candidate/submission-history",
        destination: "/dashboard/candidate/submissions",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
