#import <AppKit/AppKit.h>

typedef void (*OpenExpressServiceCallback)(const char *tool_id, const char *file_path);

static OpenExpressServiceCallback g_openexpress_service_callback = NULL;

@interface OpenExpressServiceProvider : NSObject
- (void)openexpressService:(NSPasteboard *)pboard userData:(NSString *)userData error:(NSString **)error;
@end

@implementation OpenExpressServiceProvider

- (void)openexpressService:(NSPasteboard *)pboard userData:(NSString *)userData error:(NSString **)error {
  if (g_openexpress_service_callback == NULL) {
    if (error != NULL) {
      *error = @"OpenExpress Services are not ready yet.";
    }
    return;
  }

  NSString *toolId = userData ?: @"";
  NSArray<NSURL *> *urls = [pboard readObjectsForClasses:@[[NSURL class]]
                                                 options:@{NSPasteboardURLReadingFileURLsOnlyKey: @YES}];

  for (NSURL *url in urls) {
    if (![url isFileURL]) {
      continue;
    }

    NSString *path = [url path];
    if ([path length] == 0) {
      continue;
    }

    g_openexpress_service_callback([toolId UTF8String], [path UTF8String]);
    return;
  }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  NSArray *filenames = [pboard propertyListForType:NSFilenamesPboardType];
#pragma clang diagnostic pop
  for (id filename in filenames) {
    if (![filename isKindOfClass:[NSString class]] || [filename length] == 0) {
      continue;
    }

    g_openexpress_service_callback([toolId UTF8String], [filename UTF8String]);
    return;
  }

  if (error != NULL) {
    *error = @"OpenExpress could not read the selected file.";
  }
}

@end

static OpenExpressServiceProvider *g_openexpress_service_provider = nil;

void openexpress_register_services_provider(OpenExpressServiceCallback callback) {
  g_openexpress_service_callback = callback;

  if (g_openexpress_service_provider == nil) {
    g_openexpress_service_provider = [[OpenExpressServiceProvider alloc] init];
  }

  [[NSApplication sharedApplication] setServicesProvider:g_openexpress_service_provider];
  NSUpdateDynamicServices();
}
