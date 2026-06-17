package logger

import (
	"log"
	"os"
)

// Init configures the global logger to write to stdout.
func Init() {
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags)
}
