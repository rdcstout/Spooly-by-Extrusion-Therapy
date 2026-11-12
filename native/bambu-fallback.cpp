// Status-only bridge to the user's installed networking library. No vendor
// binaries, account credentials, or session files are distributed with Spooly.
#include <string>
#include <functional>
#include <vector>
#include <thread>
#include <chrono>
#include <iostream>
#include <mutex>
#include <atomic>
#include <csignal>
#ifdef _WIN32
#define NOMINMAX
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#define dup _dup
#define dup2 _dup2
#define write _write
#define open _open
#define _exit _exit
#else
#include <dlfcn.h>
#include <unistd.h>
#include <fcntl.h>
#endif
static int output;
static std::mutex outputMutex;
static std::atomic<bool> stopping{false};
static void stop(int) { stopping=true; }
static void emit(const std::string& kind,const std::string& body) {
 if(body.size()>1024*1024 || body.find('\n')!=std::string::npos || body.find('\r')!=std::string::npos)return;
 std::lock_guard<std::mutex> guard(outputMutex);
 std::string line=kind+"\t"+body+"\n";
 size_t offset=0;while(offset<line.size()){int n=write(output,line.data()+offset,(unsigned)(line.size()-offset));if(n<=0)_exit(0);offset+=n;}
}
template<class T> T symbol(void* library,const char* name) {
#ifdef _WIN32
 auto p=reinterpret_cast<T>(GetProcAddress((HMODULE)library,name));
#else
 auto p=reinterpret_cast<T>(dlsym(library,name));
#endif
 if(!p){emit("error","unsupported");_exit(3);}return p;
}
int main() {
 std::signal(SIGTERM,stop);std::signal(SIGINT,stop);
 output=dup(1);
#ifdef _WIN32
 int nul=open("NUL",_O_WRONLY);_setmode(output,_O_BINARY);
#else
 int nul=open("/dev/null",O_WRONLY);
#endif
 dup2(nul,1);dup2(nul,2);
 std::string library,config,certDir,certFile,country,serial;
 if(!std::getline(std::cin,library)||!std::getline(std::cin,config)||!std::getline(std::cin,certDir)||!std::getline(std::cin,certFile)||!std::getline(std::cin,country)||!std::getline(std::cin,serial))return 2;
 // Parent owns stdin: loss of the parent closes it and ends this helper.
 std::thread([]{std::string ignored;while(std::getline(std::cin,ignored)){}stopping=true;}).detach();
#ifdef _WIN32
 int size=MultiByteToWideChar(CP_UTF8,0,library.c_str(),-1,nullptr,0);std::wstring wide(size,L'\0');
 MultiByteToWideChar(CP_UTF8,0,library.c_str(),-1,wide.data(),size);
 void* h=LoadLibraryExW(wide.c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
#else
 void* h=dlopen(library.c_str(),RTLD_NOW|RTLD_LOCAL);
#endif
 if(!h){emit("error","unavailable");return 2;}
 auto a=symbol<void*(*)(std::string)>(h,"bambu_network_create_agent")(config);
 if(!a){emit("error","unavailable");return 2;}
 symbol<int(*)(void*,std::string)>(h,"bambu_network_set_config_dir")(a,config);
 symbol<int(*)(void*,std::string)>(h,"bambu_network_set_country_code")(a,country);
 symbol<int(*)(void*,std::string,std::string)>(h,"bambu_network_set_cert_file")(a,certDir,certFile);
 symbol<int(*)(void*,std::function<std::string()>)>(h,"bambu_network_set_get_country_code_fn")(a,[country]{return country;});
 symbol<int(*)(void*,std::function<void(std::function<void()>)>)>(h,"bambu_network_set_queue_on_main_fn")(a,[](std::function<void()> f){f();});
 std::atomic<bool> connected{false};
 symbol<int(*)(void*,std::function<void(int,int)>)>(h,"bambu_network_set_on_server_connected_fn")(a,[&](int r,int){connected=r==0;emit("connection",r==0?"connected":"offline");});
 symbol<int(*)(void*,std::function<void(std::string,std::string)>)>(h,"bambu_network_set_on_message_fn")(a,[serial](std::string id,std::string body){if(id==serial)emit("report",body);});
 symbol<void(*)(void*,bool)>(h,"bambu_network_enable_multi_machine")(a,true);
 // Initialize the SDK before starting its account and telemetry services.
 if(symbol<int(*)(void*)>(h,"bambu_network_init_log")(a)!=0){emit("error","unavailable");return 4;}
 symbol<int(*)(void*)>(h,"bambu_network_start")(a);
 if(!symbol<bool(*)(void*)>(h,"bambu_network_is_user_login")(a)){emit("error","session");return 4;}
 if(serial=="--check"){emit("available","true");_exit(0);}
 symbol<int(*)(void*)>(h,"bambu_network_connect_server")(a);
 for(int i=0;i<200&&!connected&&!stopping;i++)std::this_thread::sleep_for(std::chrono::milliseconds(100));
 if(!connected){emit("error","network");_exit(5);}
 if(serial=="--list") {
  unsigned http=0;std::string body;
  int result=symbol<int(*)(void*,unsigned*,std::string*)>(h,"bambu_network_get_user_print_info")(a,&http,&body);
  if(result==0&&http==200)emit("printers",body);else emit("error","network");
  _exit(result==0&&http==200?0:5);
 }
 symbol<int(*)(void*,std::string)>(h,"bambu_network_start_subscribe")(a,"app");
 int rc=symbol<int(*)(void*,std::vector<std::string>)>(h,"bambu_network_add_subscribe")(a,{serial});
 if(rc){emit("error","subscription");_exit(6);}
 std::this_thread::sleep_for(std::chrono::seconds(3));
 symbol<int(*)(void*,std::string)>(h,"bambu_network_set_user_selected_machine")(a,serial);
 auto send=symbol<int(*)(void*,std::string,std::string,int,int)>(h,"bambu_network_send_message");
 int seconds=0;
 while(!stopping){
  if(!connected){emit("error","network");break;}
  if(seconds%60==0)send(a,serial,R"({"pushing":{"sequence_id":"0","command":"pushall","version":1,"push_target":1}})",0,0);
  std::this_thread::sleep_for(std::chrono::seconds(1));seconds++;
 }
 _exit(0);
}
