"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Globe, Moon, Sun, Download, RefreshCw, Github, Copy, Key } from "lucide-react"

const GITHUB_OWNER = 'sudo-self'
const GITHUB_REPO = 'apk-builder-actions'
const GITHUB_TOKEN = process.env.NEXT_PUBLIC_GITHUB_TOKEN

export default function APKBuilder() {
  const [url, setUrl] = useState("")
  const [appName, setAppName] = useState("")
  const [hostName, setHostName] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [showBootScreen, setShowBootScreen] = useState(true)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [githubRunId, setGithubRunId] = useState<string | null>(null)
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null)
  const [buildStartTime, setBuildStartTime] = useState<number>(0)
  const [showAppKey, setShowAppKey] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (url) {
      try {
        const urlObj = new URL(url)
        setHostName(urlObj.hostname)
        if (!appName) {
          const defaultName = urlObj.hostname.replace(/^www\./, '').split('.')[0]
          setAppName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1))
        }
      } catch (e) {
        // Invalid URL, ignore
      }
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

    const pollInterval = setInterval(async () => {
      try {
        const result = await checkBuildStatus(githubRunId)
        
        if (result.status === 'success') {
          clearInterval(pollInterval)
          setIsBuilding(false)
          setIsComplete(true)
          setTerminalLogs(prev => [...prev, "Build completed. APK is ready for download."])
          
          if (result.artifactUrl) {
            setArtifactUrl(result.artifactUrl)
          }
        } else if (result.status === 'failed') {
          clearInterval(pollInterval)
          setIsBuilding(false)
          setTerminalLogs(prev => [...prev, "Build failed. Check GitHub Actions for details."])
        }
      } catch (error) {
        console.error('Error polling GitHub status:', error)
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [isBuilding, githubRunId])

  const checkBuildStatus = async (runId: string): Promise<{ status: string; artifactUrl?: string }> => {
    if (!GITHUB_TOKEN) {
      console.error('GitHub token not configured')
      return { status: 'unknown' }
    }
    
    try {
      const runResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      )
      
      if (!runResponse.ok) {
        console.error('Failed to check build status:', runResponse.status)
        return { status: 'unknown' }
      }
      
      const runData = await runResponse.json()
      
      if (runData.status === 'completed') {
        if (runData.conclusion === 'success') {
          const artifactsResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts`,
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          )
          
          if (artifactsResponse.ok) {
            const artifactsData = await artifactsResponse.json()
            if (artifactsData.artifacts && artifactsData.artifacts.length > 0) {
              const artifact = artifactsData.artifacts[0]
              return { 
                status: 'success', 
                artifactUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts/${artifact.id}`
              }
            }
          }
          return { status: 'success' }
        } else {
          return { status: 'failed' }
        }
      }
      
      return { status: runData.status }
    } catch (error) {
      console.error('Error checking build status:', error)
      return { status: 'unknown' }
    }
  }

  const validateWebsite = async (url: string): Promise<boolean> => {
    try {
      const urlObj = new URL(url)
      if (!urlObj.hostname || !urlObj.protocol.startsWith('http')) {
        return false
      }
      return true
    } catch (e) {
      return false
    }
  }

  const triggerGitHubAction = async (buildData: any) => {
    if (!GITHUB_TOKEN) {
      throw new Error('GitHub token not configured. Please set NEXT_PUBLIC_GITHUB_TOKEN.')
    }

    console.log('Triggering GitHub Action with data:', buildData)

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'apk_build',
            client_payload: buildData
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub API error:', response.status, errorText)
        throw new Error(`GitHub API error: ${response.status}`)
      }

      console.log('GitHub Action triggered successfully')

      await new Promise(resolve => setTimeout(resolve, 2000))

      const runsResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?event=repository_dispatch&per_page=5`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      )

      if (runsResponse.ok) {
        const runsData = await runsResponse.json()
        console.log('Found workflow runs:', runsData.workflow_runs?.length)
        
        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
          const recentRun = runsData.workflow_runs[0]
          console.log('Most recent run:', recentRun.id, recentRun.status)
          return recentRun.id
        }
      }

      console.warn('No workflow runs found')
      return null

    } catch (error) {
      console.error('Error triggering GitHub action:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (url && appName && hostName) {
      // Validate website format before proceeding
      const isValidWebsite = await validateWebsite(url)
      if (!isValidWebsite) {
        setTerminalLogs(["Invalid website URL format. Please include http:// or https://"])
        return
      }

      setIsBuilding(true)
      setTerminalLogs([])
      setGithubRunId(null)
      setArtifactUrl(null)
      setBuildStartTime(Date.now())
      setShowAppKey(false)

      try {
        console.log('Starting build process...')
        console.log('Environment check - GitHub Token:', GITHUB_TOKEN ? 'Set' : 'Not set')

        const buildId = `build_${Date.now()}`
        setBuildId(buildId)

        const buildData = {
          buildId,
          hostName: hostName.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          launchUrl: '/',
          name: appName,
          launcherName: appName,
          themeColor: '#171717',
          themeColorDark: '#000000',
          backgroundColor: '#FFFFFF'
        }

        console.log('Sending build data:', buildData)

        setTerminalLogs(prev => [...prev, "Starting build process..."])
        
        const runId = await triggerGitHubAction(buildData)
        
        if (runId) {
          console.log('GitHub Run ID received:', runId)
          setGithubRunId(runId.toString())
          setTerminalLogs(prev => [...prev, `GitHub Actions run started: #${runId}`, "Monitoring build progress..."])
        } else {
          throw new Error('Failed to get GitHub Actions run ID')
        }

      } catch (error: any) {
        console.error('Build error:', error)
        let errorMessage = error.message
        
        if (errorMessage.includes('GitHub API error: 404')) {
          errorMessage = 'GitHub repository not found or access denied'
        } else if (errorMessage.includes('GitHub API error: 403')) {
          errorMessage = 'GitHub token invalid or missing permissions'
        } else if (errorMessage.includes('GitHub token not configured')) {
          errorMessage = 'GitHub token not configured. Check your environment variables.'
        }
        
        setTerminalLogs(prev => [...prev, `Build failed: ${errorMessage}`, "Please check the console for details"])
        setTimeout(() => {
          setIsBuilding(false)
        }, 3000)
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
    if (artifactUrl) {
      window.open(artifactUrl, '_blank')
    } else if (githubRunId) {
      window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')
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
    setUrl("")
    setAppName("")
    setHostName("")
    setTerminalLogs([])
    setBuildId(null)
    setGithubRunId(null)
    setArtifactUrl(null)
    setBuildStartTime(0)
    setShowAppKey(false)
    setCopied(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[3rem] shadow-2xl border-8 border-[#3DDC84] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-10" />

          <div
            className={`absolute inset-[6px] rounded-[2.5rem] overflow-hidden transition-colors ${
              isDarkMode ? "bg-black" : "bg-gradient-to-b from-slate-50 to-slate-100"
            }`}
          >     
            {showBootScreen ? (
              <div className="h-full bg-black flex flex-col items-center justify-center rounded-[2.5rem]">
                <div className="animate-in fade-in zoom-in duration-1000">
                  <svg className="w-32 h-32 text-[#3DDC84] mb-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5V19h17v-2.5c0-2.66-1.3-5.34-2.9-7.02zM7 17.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
                  </svg>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce" />
                </div>
                <p className="text-[#3DDC84] text-sm font-medium animate-pulse">Android</p>
              </div>
            ) : (
              <>
                <div
                  className={`h-12 flex items-center justify-between px-8 text-xs rounded-t-[2.5rem] ${
                    isDarkMode ? "bg-slate-950 text-white" : "bg-slate-900 text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 text-[#3DDC84]">
                    <span className="font-semibold">{formatTime(currentTime)}</span>
                    <span className="opacity-80">{formatDate(currentTime)}</span>
                  </div>
                  <div className="flex gap-3 items-center text-[#3DDC84]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5V19h17v-2.5c0-2.66-1.3-5.34-2.9-7.02zM7 17.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
                    </svg>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="hover:opacity-70 transition-opacity"
                      aria-label="Toggle theme"
                    >
                      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="h-[calc(100%-3rem-24px)] overflow-y-auto p-6">
                  {isBuilding ? (
                    <div className="h-full bg-black rounded-xl p-4 overflow-y-auto font-mono">
                      <div className="flex items-center gap-2 mb-4 text-green-400 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="ml-2">apk.jessejesse.com</span>
                      </div>

                      <div className="space-y-2">
                        {terminalLogs.map((log, index) => (
                          <div
                            key={index}
                            className="text-green-400 text-sm animate-in fade-in slide-in-from-left-2"
                          >
                            <span className="text-green-600 mr-2">$</span> {log}
                          </div>
                        ))}
                        
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <span className="text-green-600">$</span>
                          <div className="flex gap-1">
                            <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span>Building APK...</span>
                        </div>

                        {githubRunId && (
                          <div className="text-gray-400 text-xs mt-4 pt-2 border-t border-slate-700">
                            <a 
                              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline hover:pink-500"
                            >
                              source code on GitHub
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : !isComplete ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-3 shadow-lg">
                          <Github className="w-8 h-8 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          Android App Builder
                        </h1>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          build Android apps in seconds
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="url"
                          className={`font-medium flex items-center gap-2 ${
                            isDarkMode ? "text-white" : "text-slate-900"
                          }`}
                        >
                          <Globe className="w-4 h-4" />
                          Website URL
                        </Label>
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://example.com"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className={
                            isDarkMode
                              ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                              : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="appName"
                          className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}
                        >
                          App Name
                        </Label>
                        <Input
                          id="appName"
                          type="text"
                          placeholder="Enter app name"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          className={
                            isDarkMode
                              ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                              : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="hostName"
                          className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}
                        >
                          Domain (.com .org .net)
                        </Label>
                        <Input
                          id="hostName"
                          type="text"
                          placeholder="example.com"
                          value={hostName}
                          onChange={(e) => setHostName(e.target.value)}
                          className={
                            isDarkMode
                              ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                              : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                        <p className={`text-xs text-center ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                        slower connections builds may take 2-3 mins
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!url || !appName || !hostName}
                      >
                        <Github className="w-5 h-5 mr-2" />
                        Build App
                      </Button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-500">
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4 animate-in zoom-in duration-300">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          Build Complete
                        </h2>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Your Android App is ready for download
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-3 mb-8">
                        <div
                          className={`w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border-2 ${
                            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-lg">{appName.charAt(0)}</span>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-semibold max-w-[80px] text-center leading-tight ${
                            isDarkMode ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {appName}
                        </p>
                      </div>

                      <Button
                        onClick={downloadAPK}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg mb-4 transition-all hover:shadow-xl"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Download APP
                      </Button>

                      {githubRunId && (
                        <>
                          <Button
                            onClick={() => setShowAppKey(!showAppKey)}
                            variant="outline"
                            className={`w-full mb-4 transition-all ${
                              isDarkMode
                                ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                                : "bg-white border-slate-300 text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <Key className="w-5 h-5 mr-2" />
                            {showAppKey ? "Hide App Key" : "View App Key"}
                          </Button>

                          {showAppKey && (
                            <div className={`w-full p-4 rounded-lg mb-4 border ${
                              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-300"
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                  App Signing Key
                                </h3>
                                <Button
                                  onClick={copyAppKey}
                                  size="sm"
                                  variant="ghost"
                                  className={`h-8 px-2 ${
                                    isDarkMode 
                                      ? "text-slate-300 hover:bg-slate-700" 
                                      : "text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  {copied ? "Copied" : "Copy"}
                                </Button>
                              </div>
                              <div className={`font-mono text-sm space-y-1 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                                <div>Alias: <span className="font-bold">android</span></div>
                                <div>Password: <span className="font-bold">123321</span></div>
                              </div>
                              <p className={`text-xs mt-3 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                                You will need this key to publish changes to your app.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      <Button
                        onClick={resetForm}
                        variant="outline"
                        className={`w-full transition-all ${
                          isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                            : "bg-white border-slate-300 text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Build Another App
                      </Button>
                    </div>
                  )}
                </div>

                <div className={`h-8 flex items-center justify-center border-t ${
                  isDarkMode 
                    ? "bg-slate-900 border-slate-800" 
                    : "bg-slate-100 border-slate-300"
                } rounded-b-[2.5rem]`}>
                  <a 
                    href="https://github.com/sudo-self/apk-builder-actions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src="https://img.shields.io/badge/-sudo--self-lightgrey?style=plastic&logo=github" 
                      alt="sudo-self" 
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
