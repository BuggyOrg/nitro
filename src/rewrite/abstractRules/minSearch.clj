; minimum search
(defco min_impl [list min]
  (logic/if (array/empty list)
    min
    (min_impl (array/rest list)
      (logic/if (math/less (array/first list) min)
        (array/first list)
        min
      )
    )
  )
)

(defco min [list] (min_impl list (array/first list)))
