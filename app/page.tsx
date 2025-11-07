"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Globe, Moon, Sun, Download, RefreshCw, Github, Copy, Key, Palette, AlertCircle, Image, ExternalLink, CheckCircle2, Upload } from "lucide-react"

const GITHUB_OWNER = 'sudo-self'
const GITHUB_REPO = 'apk-builder-actions'

interface BuildData {
  buildId: string
  hostName: string
  launchUrl: string
  name: string
  launcherName: string
  themeColor: string
  themeColorDark: string
  backgroundColor: string
  iconChoice: string
  iconUrl: string
  publishRelease: boolean
}

interface BuildStatus {
  status: 'pending' | 'success' | 'failed' | 'unknown'
  artifactUrl?: string
  artifactId?: string
  artifactName?: string
}

interface GitHubArtifact {
  id: number
  name: string
  archive_download_url: string
  expired: boolean
}

interface GitHubRun {
  id: number
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
}

const ICON_CHOICES = [
  {
    value: "phone",
    label: "Phone Icon",
    url: "https://apk.jessejesse.com/phone-512.png"
  },
  {
    value: "castle",
    label: "Castle Icon", 
    url: "https://apk.jessejesse.com/castle-512.png"
  },
  {
    value: "smile",
    label: "Smile Icon",
    url: "https://apk.jessejesse.com/smile-512.png"
  }
]

export default function APKBuilder() {
  const [url, setUrl] = useState("")
  const [appName, setAppName] = useState("")
  const [hostName, setHostName] = useState("")
  const [themeColor, setThemeColor] = useState("#3b82f6")
  const [themeColorDark, setThemeColorDark] = useState("#1e40af")
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [iconChoice, setIconChoice] = useState("phone")
  const [publishRelease, setPublishRelease] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [showBootScreen, setShowBootScreen] = useState(true)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [githubRunId, setGithubRunId] = useState<string | null>(null)
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null)
  const [artifactId, setArtifactId] = useState<string | null>(null)
  const [artifactName, setArtifactName] = useState<string | null>(null)
  const [buildStartTime, setBuildStartTime] = useState<number>(0)
  const [showAppKey, setShowAppKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle')

  // Get selected icon URL
  const selectedIcon = ICON_CHOICES.find(icon => icon.value === iconChoice) || ICON_CHOICES[0]

  const getGitHubToken = (): string | null => {
    if (typeof window === 'undefined') return null
    
    const token = 
      process.env.NEXT_PUBLIC_GITHUB_TOKEN ||
      (window as any).ENV?.NEXT_PUBLIC_GITHUB_TOKEN ||
      localStorage.getItem('github_token')
    
    return token || null
  }

  const hasGitHubToken = !!getGitHubToken()

  useEffect(() => {
    if (url) {
      try {
        const urlObj = new URL(url)
        const extractedHost = urlObj.hostname
        setHostName(extractedHost)
        if (!appName) {
          const defaultName = extractedHost.replace(/^www\./, '').split('.')[0]
          setAppName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1))
        }
        setError(null)
      } catch (e) {
        setHostName("")
        if (url) {
          setError("Please enter a valid URL with http:// or https://")
        }
      }
    } else {
      setHostName("")
      setError(null)
    }
  }, [url, appName])

  useEffect(() => {
    const bootTimer = setTimeout(() => {
      setShowBootScreen(false)
    }, 3000)
    return () => clearTimeout(bootTimer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isBuilding || !githubRunId) return

    let pollCount = 0
    const maxPolls = 120
    let isCancelled = false

    const pollBuildStatus = async () => {
      if (isCancelled || pollCount >= maxPolls) {
        if (pollCount >= maxPolls) {
          setTerminalLogs(prev => [...prev, "⏰ Build timeout - check GitHub Actions for status"])
          setIsBuilding(false)
        }
        return
      }

      pollCount++

      try {
        const result = await checkBuildStatus(githubRunId)
        
        if (result.status === 'success') {
          setTerminalLogs(prev => [...prev, "✅ Build completed", "📦 APK is ready"])
          setIsBuilding(false)
          setIsComplete(true)
          
          if (result.artifactUrl) {
            setArtifactUrl(result.artifactUrl)
          }
          if (result.artifactId) {
            setArtifactId(result.artifactId)
          }
          if (result.artifactName) {
            setArtifactName(result.artifactName)
          }
        } else if (result.status === 'failed') {
          setTerminalLogs(prev => [...prev, "❌ Build failed. Check GitHub Actions for details"])
          setIsBuilding(false)
        } else {
          const elapsedMinutes = Math.floor((Date.now() - buildStartTime) / 60000)
          if (pollCount % 6 === 0) {
            setTerminalLogs(prev => [...prev, `🔄 Building... (${elapsedMinutes}m elapsed)`])
          }
          setTimeout(pollBuildStatus, 10000)
        }
      } catch (error) {
        console.error('Error polling GitHub status:', error)
        if (!isCancelled) {
          setTimeout(pollBuildStatus, 10000)
        }
      }
    }

    pollBuildStatus()

    return () => {
      isCancelled = true
    }
  }, [isBuilding, githubRunId, buildStartTime])

  const checkBuildStatus = async (runId: string): Promise<BuildStatus> => {
    const token = getGitHubToken()
    if (!token) {
      throw new Error('GitHub token not configured')
    }
    
    try {
      const runResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      )
      
      if (!runResponse.ok) {
        if (runResponse.status === 404) {
          throw new Error(`Workflow run ${runId} not found`)
        } else if (runResponse.status === 403) {
          throw new Error('GitHub token invalid or missing permissions')
        } else if (runResponse.status === 401) {
          throw new Error('GitHub token is invalid')
        }
        throw new Error(`GitHub API error: ${runResponse.status} ${runResponse.statusText}`)
      }
      
      const runData: GitHubRun = await runResponse.json()
      
      if (runData.status === 'completed') {
        if (runData.conclusion === 'success') {
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          const artifactsResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
              }
            }
          )
          
          if (artifactsResponse.ok) {
            const artifactsData = await artifactsResponse.json()
            if (artifactsData.artifacts && artifactsData.artifacts.length > 0) {
              const artifact: GitHubArtifact = artifactsData.artifacts[0]
              if (!artifact.expired) {
                return { 
                  status: 'success', 
                  artifactUrl: artifact.archive_download_url,
                  artifactId: artifact.id.toString(),
                  artifactName: artifact.name
                }
              } else {
                throw new Error('Artifact has expired')
              }
            } else {
              return { status: 'success' }
            }
          } else if (artifactsResponse.status === 404) {
            return { status: 'success' }
          } else {
            throw new Error(`Failed to fetch artifacts: ${artifactsResponse.status}`)
          }
        } else {
          return { status: 'failed' }
        }
      }
      
      return { status: 'pending' }
    } catch (error) {
      console.error('Error checking build status:', error)
      throw error
    }
  }
      
  const validateWebsite = async (url: string): Promise<boolean> => {
    try {
      const urlObj = new URL(url)
      return !!(urlObj.hostname && urlObj.protocol.startsWith('http') && urlObj.hostname.includes('.'))
    } catch (e) {
      return false
    }
  }

  const triggerGitHubAction = async (buildData: BuildData): Promise<string | null> => {
    const token = getGitHubToken()
    if (!token) {
      throw new Error('GitHub token not configured. Please check your environment variables.')
    }

    try {
      // Verify the repository exists and we have access
      const repoResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      )

      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          throw new Error(`Repository ${GITHUB_OWNER}/${GITHUB_REPO} not found or access denied`)
        } else if (repoResponse.status === 403) {
          throw new Error('GitHub token invalid or missing repository permissions')
        } else if (repoResponse.status === 401) {
          throw new Error('GitHub token is invalid or expired')
        }
        throw new Error(`GitHub API error: ${repoResponse.status} - ${repoResponse.statusText}`)
      }

      // Reduce payload to 10 properties by combining some fields
      const optimizedPayload = {
        buildId: buildData.buildId,
        hostName: buildData.hostName,
        name: buildData.name,
        // Combine theme colors into one field to save space
        theme: JSON.stringify({
          color: buildData.themeColor,
          colorDark: buildData.themeColorDark,
          background: buildData.backgroundColor
        }),
        icon: buildData.iconChoice,
        iconUrl: buildData.iconUrl,
        // Combine other fields
        config: JSON.stringify({
          launchUrl: buildData.launchUrl,
          launcherName: buildData.launcherName,
          publishRelease: buildData.publishRelease
        })
      }

      console.log('Sending optimized payload:', optimizedPayload)

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            event_type: 'apk_build',
            client_payload: optimizedPayload
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub dispatch error:', errorText)
        
        if (response.status === 404) {
          throw new Error('GitHub repository not found or access denied. Check repository name and permissions.')
        } else if (response.status === 403) {
          throw new Error('GitHub token missing "workflow" scope permission. Please add workflow scope to your token.')
        } else if (response.status === 401) {
          throw new Error('GitHub token is invalid or expired. Please check your token.')
        } else if (response.status === 422) {
          if (errorText.includes('10 properties')) {
            throw new Error('Too many properties in payload. Please contact support.')
          } else {
            throw new Error('Workflow dispatch failed. Check if the workflow file exists in the repository.')
          }
        } else {
          throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`)
        }
      }

      // Wait for the workflow to start
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Poll for the workflow run with more attempts
      for (let attempt = 0; attempt < 12; attempt++) {
        const runsResponse = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?event=repository_dispatch&per_page=5&sort=created&direction=desc`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        )

        if (runsResponse.ok) {
          const runsData = await runsResponse.json()
          if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
            // Find the most recent repository_dispatch run
            const recentRun = runsData.workflow_runs.find((run: any) => 
              run.event === 'repository_dispatch' && 
              run.status === 'in_progress'
            ) || runsData.workflow_runs[0]
            
            if (recentRun) {
              return recentRun.id.toString()
            }
          }
        } else {
          console.warn(`Failed to fetch runs on attempt ${attempt + 1}:`, runsResponse.status)
        }

        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      throw new Error('Failed to get GitHub Actions run ID after multiple attempts. Check GitHub Actions manually.')

    } catch (error) {
      console.error('Error triggering GitHub action:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!getGitHubToken()) {
      setError('GitHub token not configured. Please check your environment setup.')
      return
    }
    
    if (url && appName && hostName) {
      const isValidWebsite = await validateWebsite(url)
      if (!isValidWebsite) {
        setError("Invalid website URL format. Please include http:// or https:// and a valid domain.")
        return
      }

      setIsBuilding(true)
      setError(null)
      setTerminalLogs([])
      setGithubRunId(null)
      setArtifactUrl(null)
      setArtifactId(null)
      setBuildStartTime(Date.now())
      setShowAppKey(false)
      setDownloadStatus('idle')

      try {
        const buildId = `build_${Date.now()}`
        setBuildId(buildId)

        const cleanHostName = url
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '')
        

        const buildData: BuildData = {
          buildId,
          hostName: cleanHostName,
          launchUrl: '/',
          name: appName,
          launcherName: appName,
          themeColor: themeColor,
          themeColorDark: themeColorDark,
          backgroundColor: backgroundColor,
          iconChoice: iconChoice,
          iconUrl: selectedIcon.url,
          publishRelease: publishRelease
        }
        
        setTerminalLogs([
          "Starting build...",
          `📱 ${appName}`,
          `${cleanHostName}`,
          ` ${themeColor}`,
          `${iconChoice}`,
          `📦 Relelase: ${publishRelease ? 'Yes' : 'No'}`,
          `Build ID: ${buildId}`,
          "Downloading custom icon...",
          "Configuring app theme...",
          ""
        ])

        const runId = await triggerGitHubAction(buildData)
        
        if (runId) {
          setGithubRunId(runId)
          setTerminalLogs(prev => [
            ...prev,
            `GitHub Actions`,
            `Run ID: ${runId}`,
            "Build in progress...",
            "Replacing default icons",
            "Creating artifact",
            "may take 2-5 minutes...",
            ""
          ])
        } else {
          throw new Error('Failed to get GitHub Actions run ID. The build may have started - check GitHub Actions.')
        }

      } catch (error: any) {
        console.error('Build error:', error)
        const errorMessage = error.message || 'Unknown error occurred'
        setTerminalLogs(prev => [...prev, `❌ Build failed: ${errorMessage}`])
        setError(errorMessage)
        setIsBuilding(false)
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const downloadAPK = async () => {
    try {
      setDownloadStatus('downloading')
      
      if (artifactId) {
        const token = getGitHubToken()
        if (!token) {
          setError('GitHub token required for download')
          setDownloadStatus('error')
          return
        }

        const downloadUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/artifacts/${artifactId}/zip`
        
        try {
          const response = await fetch(downloadUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          })
          
          if (response.ok) {
            const blob = await response.blob()
            
            const safeAppName = appName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            const filename = `${safeAppName}_${buildId || 'app'}.apk`
            
            const blobUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = filename
            a.style.display = 'none'
            
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(blobUrl)
            
            setDownloadStatus('success')
            setTimeout(() => setDownloadStatus('idle'), 3000)
          } else {
            throw new Error(`Download failed: ${response.status}`)
          }
        } catch (fetchError) {
          console.error('Direct download failed, falling back to GitHub:', fetchError)
          if (githubRunId) {
            window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')
          }
          setDownloadStatus('idle')
        }
        
      } else if (githubRunId) {
        window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')
        setDownloadStatus('idle')
      }
    } catch (error: any) {
      console.error('Download error:', error)
      setError(`Download failed: ${error.message}`)
      setDownloadStatus('error')
      
      if (githubRunId) {
        window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')
      }
    }
  }

  const copyAppKey = async () => {
    const keyInfo = `Alias: android\nPassword: 123321\n\nYou will need this key to publish changes to your app.`
    
    try {
      await navigator.clipboard.writeText(keyInfo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = keyInfo
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const resetForm = () => {
    setIsComplete(false)
    setIsBuilding(false)
    setUrl("")
    setAppName("")
    setHostName("")
    setThemeColor("#3b82f6")
    setThemeColorDark("#1e40af")
    setBackgroundColor("#ffffff")
    setIconChoice("phone")
    setPublishRelease(false)
    setTerminalLogs([])
    setBuildId(null)
    setGithubRunId(null)
    setArtifactUrl(null)
    setArtifactId(null)
    setBuildStartTime(0)
    setShowAppKey(false)
    setCopied(false)
    setShowAdvanced(false)
    setError(null)
    setDownloadStatus('idle')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div 
          className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[3rem] shadow-2xl border-8 border-transparent overflow-hidden p-0.5"
          style={{
            backgroundImage: 'linear-gradient(black, black), linear-gradient(to bottom, #6b7280, #7e22ce, #3b82f6, #06b6d4)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'content-box, border-box',
            backgroundSize: '100% 100%'
          }}
        >
          {error && !isBuilding && (
            <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg z-20 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          {!hasGitHubToken && (
            <div className="absolute top-4 left-4 right-4 bg-yellow-500 text-white p-3 rounded-lg z-20 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">GitHub token not configured</span>
              </div>
            </div>
          )}

          <div className={`absolute inset-[6px] rounded-[2.5rem] overflow-hidden transition-colors ${
            isDarkMode ? "bg-black" : "bg-gradient-to-b from-slate-50 to-slate-100"
          }`}>     
            {showBootScreen ? (
              <div className="h-full bg-black flex flex-col items-center justify-center rounded-[2.5rem]">
                <div className="animate-in fade-in zoom-in duration-1000">
                  <img 
                    src="./droiddroid.svg" 
                    alt="Android Logo"
                    className="w-32 h-32 mb-8"
                  />
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[#3DDC84] text-lg font-medium animate-pulse">A N D R O I D</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`h-12 flex items-center justify-between px-8 text-xs rounded-t-[2.5rem] ${
                  isDarkMode ? "bg-slate-950 text-white" : "bg-slate-900 text-white"
                }`}>
                  <div className="flex items-center gap-3 text-[#3DDC84]">
                    <span className="font-semibold">{formatTime(currentTime)}</span>
                    <span className="opacity-80">{formatDate(currentTime)}</span>
                  </div>
                  <div className="flex gap-4 items-center text-[#3DDC84]">
                    <a
                      href="https://github.com/sudo-self/apk-builder-actions/actions/workflows/apk-builder.yml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      <img
                        src="https://img.shields.io/github/actions/workflow/status/sudo-self/apk-builder-actions/apk-builder.yml?color=blue&style=plastic"
                        alt="APK Builder Workflow Status"
                        className="h-4"
                      />
                    </a>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="hover:opacity-70 transition-opacity"
                      aria-label="Toggle theme"
                    >
                      {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="h-[calc(100%-3rem-24px)] overflow-y-auto p-6">
                  {isBuilding || isComplete ? (
                    <div className="h-full bg-black rounded-xl p-4 overflow-y-auto font-mono">
                      <div className="flex items-center gap-2 mb-4 text-green-400 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="ml-2">Command Line</span>
                      </div>

                      <div className="space-y-2">
                        {terminalLogs.map((log, index) => (
                          <div key={index} className="text-green-400 text-sm animate-in fade-in slide-in-from-left-2">
                            <span className="text-cyan-600 mr-2">$</span> {log}
                          </div>
                        ))}
                        
                        {isBuilding && (
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <span className="text-green-600">$</span>
                            <div className="flex gap-1">
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse"></div>
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span>_</span>
                          </div>
                        )}

                        {isComplete && (
                          <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                            <div className="text-center mb-4">
                              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                              <h3 className="text-green-400 font-semibold">APK Ready!</h3>
                              <p className="text-gray-400 text-sm mt-1">
                                Your Android app was built successfully
                              </p>
                            </div>

                            <div className="space-y-3">
                              <Button
                                onClick={downloadAPK}
                                disabled={downloadStatus === 'downloading'}
                                className="w-full bg-green-600 hover:bg-green-700 text-white transition-all"
                              >
                                {downloadStatus === 'downloading' ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Downloading...
                                  </>
                                ) : downloadStatus === 'success' ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Downloaded!
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download APK
                                  </>
                                )}
                              </Button>

                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() => window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')}
                                  variant="outline"
                                  className="text-green-400 border-green-400 hover:bg-green-400 hover:text-black text-xs"
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  GitHub
                                </Button>
                                
                                <Button
                                  onClick={resetForm}
                                  variant="outline"
                                  className="text-gray-400 border-gray-400 hover:bg-gray-400 hover:text-black text-xs"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  New Build
                                </Button>
                              </div>

                              <div className="bg-slate-800 rounded-lg p-3 text-xs text-gray-300">
                                <p className="font-medium mb-1">Download Instructions:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  <li>Click Download APK above</li>
                                  <li>File will download as <code>.apk</code></li>
                                  <li>Install the APK on your Android phone</li>
                                  <li>Enable "Install from unknown sources" if needed</li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        )}

                        {githubRunId && isBuilding && (
                          <div className="text-gray-400 text-xs text-center mt-4 pt-2 border-t border-slate-700">
                            <button 
                              onClick={() => window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')}
                              className="underline hover:no-underline hover:text-blue-400 text-blue-300"
                            >
                              View live build on GitHub →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                     
                      <div className="text-center mb-6">
                        <div 
                          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-3 shadow-lg border-2"
                          style={{
                            backgroundColor: backgroundColor,
                            borderColor: themeColor
                          }}
                        >
                          <img 
                            src={selectedIcon.url} 
                            alt="App Icon Preview"
                            className="w-12 h-12 object-contain"
                            style={{
                              filter: `drop-shadow(0 2px 4px ${themeColor}40)`
                            }}
                          />
                        </div>
                        <h1 
                          className="text-xl font-bold mb-1 truncate max-w-[200px] mx-auto"
                          style={{ color: themeColor }}
                        >
                          {appName || "YourApp"}
                        </h1>
                        <p 
                          className="text-xs opacity-75"
                          style={{ color: themeColor }}
                        >
                          {hostName || "yourapp.com"}
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                         build native Android apps with Kotlin
                        </p>
                         <p className={`text-xs mt-2 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          webkit.WebView 
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="url" className={`font-medium flex items-center gap-2 ${
                          isDarkMode ? "text-white" : "text-slate-900"
                        }`}>
                         Web Address
                        </Label>
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://YourApp.com"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="appName" className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          Name
                        </Label>
                        <Input
                          id="appName"
                          type="text"
                          placeholder="YourApp Name"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hostName" className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                         Domain
                        </Label>
                        <Input
                          id="hostName"
                          type="text"
                          placeholder="YourApp.com"
                          value={hostName}
                          onChange={(e) => setHostName(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                        <p className={`text-xs text-center ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                          apk build time approx 1-3 mins
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 p-3 rounded-lg border" style={{
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc'
                      }}>
                        <input
                          type="checkbox"
                          id="publishRelease"
                          checked={publishRelease}
                          onChange={(e) => setPublishRelease(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <Label htmlFor="publishRelease" className={`font-medium flex items-center gap-2 ${
                          isDarkMode ? "text-white" : "text-slate-900"
                        }`}>
                          <Upload className="w-4 h-4" />
                          Publish Release
                        </Label>
                      </div>
                      <p className={`text-xs text-center ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                        publish APK as a GitHub release
                      </p>

                      <Button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        variant="ghost"
                        className={`w-full flex items-center justify-center gap-2 ${
                          isDarkMode ? "text-slate-400" : "text-slate-600"
                        }`}
                      >
                        <Palette className="w-4 h-4" />
                        {showAdvanced ? "Hide" : "Show"} Advanced Options
                      </Button>

                      {showAdvanced && (
                        <div className="space-y-4 p-4 rounded-lg border" style={{
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc'
                        }}>
                          <div className="space-y-2">
                            <Label htmlFor="iconChoice" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              <Image className="w-4 h-4" />
                              App Icon
                            </Label>
                            
                            <div className="grid grid-cols-3 gap-3">
                              {ICON_CHOICES.map((icon) => (
                                <div
                                  key={icon.value}
                                  className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                    iconChoice === icon.value
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                  }`}
                                  onClick={() => setIconChoice(icon.value)}
                                >
                                  <img
                                    src={icon.url}
                                    alt={icon.label}
                                    className="w-12 h-12 object-contain mb-2"
                                  />
                                  <span className="text-xs text-center font-medium">
                                    {icon.label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <select
                              id="iconChoice"
                              value={iconChoice}
                              onChange={(e) => setIconChoice(e.target.value)}
                              className={`w-full p-2 rounded border mt-2 ${
                                isDarkMode
                                  ? "bg-slate-800 border-slate-700 text-white"
                                  : "bg-white border-slate-300 text-slate-900"
                              }`}
                            >
                              {ICON_CHOICES.map((icon) => (
                                <option key={icon.value} value={icon.value}>
                                  {icon.label}
                                </option>
                              ))}
                            </select>
                            
                            <p className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                              Choose the app icon style - default launcher icon
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="themeColor" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Theme Color
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="themeColor"
                                type="color"
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="themeColorDark" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Theme Color (Dark Mode)
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="themeColorDark"
                                type="color"
                                value={themeColorDark}
                                onChange={(e) => setThemeColorDark(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={themeColorDark}
                                onChange={(e) => setThemeColorDark(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="backgroundColor" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Background Color
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="backgroundColor"
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <p
                        className={`text-xs text-center ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                      >
                        <a
                          href="https://apk.jessejesse.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-red-500"
                        >
                          RESET BUILDER
                        </a>
                      </p>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-700 hover:to-cyan-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!url || !appName || !hostName}
                      >
                        <Github className="w-5 h-5 mr-2" />
                        Build APK
                      </Button>
                    </form>
                  )}
                </div>

                <div
                  className={`h-8 flex items-center justify-center gap-2 border-t ${
                    isDarkMode
                      ? "bg-slate-900 border-slate-800"
                      : "bg-slate-100 border-slate-300"
                  } rounded-b-[2.5rem]`}
                >
                  <a
                    href="https://www.npmjs.com/package/apk-builder-cli"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="https://img.shields.io/badge/npx-apk--builder--cli-red?style=plastic&logo=npm"
                      alt="npm"
                      className="h-4"
                    />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
