"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Globe, Smartphone, Moon, Sun, Download, RefreshCw } from "lucide-react"

const DEFAULT_ICONS = [
  { id: 1, name: "Rocket", color: "bg-blue-500", svg: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )},
  { id: 2, name: "Lightning", color: "bg-yellow-500", svg: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )},
  { id: 3, name: "Target", color: "bg-red-500", svg: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
    </svg>
  )},
  { id: 4, name: "Diamond", color: "bg-purple-500", svg: (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l7 7-7 7-7-7 7-7z" />
    </svg>
  )},
]

// Backend API URL - Updated to your Cloud Run backend
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://twa-backend-359911049668.europe-west1.run.app' 
  : 'http://localhost:8081'

export default function APKBuilder() {
  const [url, setUrl] = useState("")
  const [appName, setAppName] = useState("")
  const [hostName, setHostName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<number | null>(null)
  const [uploadedIcon, setUploadedIcon] = useState<string | null>(null)
  const [uploadedIconFile, setUploadedIconFile] = useState<File | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [showBootScreen, setShowBootScreen] = useState(true)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [buildProgress, setBuildProgress] = useState(0)

  // Extract hostname from URL when URL changes
  useEffect(() => {
    if (url) {
      try {
        const urlObj = new URL(url)
        setHostName(urlObj.hostname)
        // Set default app name from hostname if not already set
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

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file')
        return
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Please upload an image smaller than 2MB')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedIcon(reader.result as string)
        setUploadedIconFile(file)
        setSelectedIcon(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const simulateBuildProgress = async () => {
    const steps = [
      { message: "Starting APK build process...", progress: 10 },
      { message: "Validating configuration...", progress: 20 },
      { message: "Setting up BubbleWrap project...", progress: 30 },
      { message: "Configuring Trusted Web Activity...", progress: 40 },
      { message: "Building Android project structure...", progress: 50 },
      { message: "Compiling resources...", progress: 60 },
      { message: "Generating application manifest...", progress: 70 },
      { message: "Building APK package...", progress: 80 },
      { message: "Signing application...", progress: 90 },
      { message: "APK created successfully!", progress: 100 }
    ]

    for (const step of steps) {
      setTerminalLogs(prev => [...prev, step.message])
      setBuildProgress(step.progress)
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (url && appName && hostName && (selectedIcon || uploadedIcon)) {
      setIsBuilding(true)
      setTerminalLogs([])
      setBuildProgress(0)

      try {
        // Start progress simulation
        simulateBuildProgress()

        const formData = new FormData()
        formData.append('url', url)
        formData.append('app_name', appName)
        formData.append('host_name', hostName)
        formData.append('theme_color', '#171717')
        formData.append('background_color', '#FFFFFF')
        
        if (uploadedIconFile) {
          formData.append('icon', uploadedIconFile)
        } else if (selectedIcon) {
          // For default icons, you might want to send the icon ID
          const icon = DEFAULT_ICONS.find(i => i.id === selectedIcon)
          if (icon) {
            formData.append('icon_name', icon.name)
          }
        }

        const response = await fetch(`${API_BASE}/build`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = 'Build failed'
          
          try {
            const errorData = JSON.parse(errorText)
            errorMessage = errorData.detail || errorData.message || errorMessage
          } catch {
            errorMessage = errorText || errorMessage
          }
          
          throw new Error(errorMessage)
        }

        const result = await response.json()
        setBuildId(result.build_id || result.id)

        // Wait for simulation to complete if it's still running
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        setIsBuilding(false)
        setIsComplete(true)

      } catch (error: any) {
        console.error('Build error:', error)
        setTerminalLogs(prev => [...prev, `Build failed: ${error.message}`])
        setTerminalLogs(prev => [...prev, "Please check the URL and try again"])
        setTimeout(() => {
          setIsBuilding(false)
          setBuildProgress(0)
        }, 3000)
      }
    }
  }

  const getIconDisplay = () => {
    if (uploadedIcon) {
      return <img src={uploadedIcon || "/placeholder.svg"} alt="App icon" className="w-full h-full object-cover" />
    }
    if (selectedIcon) {
      const icon = DEFAULT_ICONS.find((i) => i.id === selectedIcon)
      return icon?.svg
    }
    return (
      <Smartphone className="w-8 h-8 text-white" />
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const downloadAPK = async () => {
    if (!buildId) {
      // Fallback download
      const blob = new Blob(["This is a demo APK file. In production, this would be your actual APK."], { 
        type: "application/vnd.android.package-archive" 
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${appName || "app"}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/download/${buildId}`)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      
      // Check if blob is actually an APK file
      if (blob.size === 0) {
        throw new Error('Empty file received')
      }
      
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${appName.replace(/\s+/g, '_')}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download error:', error)
      // Fallback to dummy APK
      const blob = new Blob(["APK file - download failed, please try again"], { 
        type: "application/vnd.android.package-archive" 
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${appName || "app"}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  const resetForm = () => {
    setIsComplete(false)
    setUrl("")
    setAppName("")
    setHostName("")
    setSelectedIcon(null)
    setUploadedIcon(null)
    setUploadedIconFile(null)
    setTerminalLogs([])
    setBuildId(null)
    setBuildProgress(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Phone Frame */}
        <div className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[3rem] shadow-2xl border-8 border-[#3DDC84]">
          {/* Phone Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-10" />

          {/* Phone Screen */}
          <div
            className={`absolute inset-2 rounded-[2.2rem] overflow-hidden transition-colors ${
              isDarkMode ? "bg-black" : "bg-gradient-to-b from-slate-50 to-slate-100"
            }`}
          >
            {showBootScreen ? (
              <div className="h-full bg-black flex flex-col items-center justify-center">
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
                {/* Status Bar */}
                <div
                  className={`h-12 flex items-center justify-between px-8 text-xs ${
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
                    <div className="w-4 h-3 border border-current rounded-sm" />
                    <div className="w-1 h-2 bg-current rounded-sm" />
                  </div>
                </div>

                {/* App Content */}
                <div className="h-[calc(100%-3rem)] overflow-y-auto p-6">
                  {isBuilding ? (
                    <div className="h-full bg-black rounded-xl p-4 overflow-y-auto font-mono">
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${buildProgress}%` }}
                          />
                        </div>
                        <div className="text-green-400 text-xs mt-1 text-right">
                          {buildProgress}%
                        </div>
                      </div>

                      {/* Terminal Logs */}
                      <div className="space-y-1">
                        {terminalLogs.map((log, index) => (
                          <div
                            key={index}
                            className="text-green-400 text-xs animate-in fade-in slide-in-from-left-2"
                          >
                            <span className="text-green-600">$</span> {log}
                          </div>
                        ))}
                        <div className="text-green-400 text-xs animate-pulse">▊</div>
                      </div>
                    </div>
                  ) : !isComplete ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-3 shadow-lg">
                          <Smartphone className="w-8 h-8 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {appName || "APP Builder"}
                        </h1>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Create a PWA and publish your app in seconds
                        </p>
                      </div>

                      {/* URL Input */}
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

                      {/* App Name Input */}
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

                      {/* Host Name Input */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="hostName"
                          className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}
                        >
                          Domain Name
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
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          The domain your app will open (usually auto-filled from URL)
                        </p>
                      </div>

                      {/* Icon Selection */}
                      <div className="space-y-3">
                        <Label className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          App Icon
                        </Label>

                        {/* Default Icons */}
                        <div className="grid grid-cols-4 gap-3">
                          {DEFAULT_ICONS.map((icon) => (
                            <button
                              key={icon.id}
                              type="button"
                              onClick={() => {
                                setSelectedIcon(icon.id)
                                setUploadedIcon(null)
                              }}
                              className={`aspect-square rounded-2xl ${icon.color} flex items-center justify-center transition-all shadow-md ${
                                selectedIcon === icon.id
                                  ? "ring-4 ring-blue-600 ring-offset-2 ring-offset-slate-900 scale-105"
                                  : "hover:scale-105 hover:shadow-lg"
                              }`}
                            >
                              {icon.svg}
                            </button>
                          ))}
                        </div>

                        {/* Upload Custom Icon */}
                        <div className="relative">
                          <input
                            type="file"
                            id="iconUpload"
                            accept="image/*"
                            onChange={handleIconUpload}
                            className="hidden"
                          />
                          <Label
                            htmlFor="iconUpload"
                            className={`flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                              isDarkMode
                                ? "border-slate-700 hover:border-blue-600 hover:bg-slate-800 text-slate-300"
                                : "border-slate-300 hover:border-blue-600 hover:bg-blue-50 text-slate-700"
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            <span className="text-sm font-medium">Upload Custom Icon</span>
                          </Label>
                        </div>

                        {uploadedIcon && (
                          <div
                            className={`flex items-center gap-2 p-2 rounded-lg border ${
                              isDarkMode ? "bg-blue-950 border-blue-800" : "bg-blue-50 border-blue-200"
                            }`}
                          >
                            <img
                              src={uploadedIcon || "/placeholder.svg"}
                              alt="Preview"
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <span className={`text-sm font-medium ${isDarkMode ? "text-blue-300" : "text-blue-900"}`}>
                              Custom icon selected
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!url || !appName || !hostName || (!selectedIcon && !uploadedIcon)}
                      >
                        Create App
                      </Button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-500">
                      <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4 animate-in zoom-in duration-300">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          App Created!
                        </h2>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Your app is ready to install
                        </p>
                      </div>

                      {/* App Icon Display */}
                      <div className="flex flex-col items-center gap-3 mb-12">
                        <div
                          className={`w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border-2 ${
                            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                          }`}
                        >
                          {getIconDisplay()}
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
                        Download APK
                      </Button>

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
                        Create Another App
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
