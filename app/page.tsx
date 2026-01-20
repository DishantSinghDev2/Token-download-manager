import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, Download } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Token Download Manager</h1>
          <Link href="/admin/login">
            <Button variant="outline">Admin</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
        <div className="text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">
            Fast, Secure Downloads at Full Speed
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Download any file using full VM bandwidth with multi-connection support and token-based security.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="#how-it-works">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-secondary/50 py-12 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-2xl font-bold mb-12 text-center">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 mb-2" />
                <CardTitle>Multi-Connection Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Download with 16 simultaneous connections to maximize VM speed
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 mb-2" />
                <CardTitle>Token-Based Security</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Each download session is protected with secure tokens and quotas
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Download className="h-8 w-8 mb-2" />
                <CardTitle>Real-Time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor download progress with live speed and ETA updates
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-24" id="how-it-works">
        <h3 className="text-2xl font-bold mb-12 text-center">How It Works</h3>
        <div className="space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                1
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Get a Download Token</h4>
              <p className="text-muted-foreground">
                Admin creates a token with quota limits, max file size, and expiry date
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                2
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Submit Download URL</h4>
              <p className="text-muted-foreground">
                Paste any direct download link in the portal using your token
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                3
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Download at Full Speed</h4>
              <p className="text-muted-foreground">
                VM downloads using full bandwidth with multiple simultaneous connections
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                4
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Get Your Download Link</h4>
              <p className="text-muted-foreground">
                Once complete, access your file via a secure public download link
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-secondary/50 border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-muted-foreground">
          <p>Token Download Manager - Production-grade file management system</p>
        </div>
      </div>
    </div>
  );
}
