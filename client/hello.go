package main

import (
	"io"
	"log"
	"net/http"
	"time"
)

func main() {

	for i := 1; i < 100; i++ {

		resp, err := http.Get("http://localhost:9192/DPM/STATUS")
		if err != nil {
			log.Fatalln(err)
		}
		//We Read the response body on the line below.
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Fatalln(err)
		}
		//Convert the body to type string
		sb := string(body)
		log.Print(sb)

		time.Sleep(time.Second)

	}
}
